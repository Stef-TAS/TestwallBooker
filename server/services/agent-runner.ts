import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { delimiter } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { ContentBlock, Tool } from '@modelcontextprotocol/sdk/types.js'
import { Copilot } from 'copilot-sdk'

export type AgentChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type AgentRunResult = {
  mode: 'math-only' | 'testwall-mcp'
  reply: string
  promptTokens: number
  completionTokens: number
  provider: 'math-fallback' | 'copilot-sdk-auth-ready' | 'testwall-mcp'
  builderTunnelReady: boolean
  configuredAgentName: string
  runtimeSupportsCustomAgent: boolean
  mcpReady: boolean
  mcpTransport: 'none' | 'stdio' | 'streamable-http'
}

type JsonObject = Record<string, unknown>

type TestwallMcpConfig =
  | { transport: 'none' }
  | {
      transport: 'stdio'
      command: string
      args: string[]
      cwd?: string
      env?: Record<string, string>
    }
  | {
      transport: 'streamable-http'
      url: string
      headers?: Record<string, string>
    }

type ToolInvocationPlan =
  { type: 'clarify'; message: string } | { type: 'call-tool'; tool: Tool; arguments: JsonObject }

export const CONFIGURED_AGENT_NAME = 'Testwall MCP Guide'

type WorkspaceMcpJson = {
  servers?: Record<
    string,
    {
      type?: string
      command?: string
      args?: unknown
      env?: unknown
      cwd?: unknown
      url?: string
      headers?: unknown
    }
  >
}

const WORKSPACE_MCP_SERVER_ID = 'io.modelcontextprotocol.anonymous/testwall-mcp'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE_MCP_JSON_PATH = path.resolve(__dirname, '../../.vscode/mcp.json')

let builderClient: Copilot | null = null

function createBuilderClient(): Copilot | null {
  const refreshToken = process.env.COPILOT_BUILDER_REFRESH_TOKEN?.trim()
  const authKey = process.env.COPILOT_BUILDER_AUTH_KEY?.trim()
  const expiration = Number(process.env.COPILOT_BUILDER_AUTH_EXPIRATION ?? 0)
  const baseUrl = process.env.COPILOT_BUILDER_BASE_URL?.trim()

  if (!refreshToken && !authKey) {
    return null
  }

  try {
    return new Copilot(refreshToken, authKey, Number.isFinite(expiration) ? expiration : 0, baseUrl)
  } catch (error) {
    console.warn('Failed to initialize Copilot SDK builder client:', error)
    return null
  }
}

function getBuilderClient(): Copilot | null {
  if (builderClient === null) {
    builderClient = createBuilderClient()
  }

  return builderClient
}

export function estimateTokenCount(text: string): number {
  const normalized = text.trim()
  if (!normalized) {
    return 0
  }

  return Math.max(1, Math.ceil(normalized.length / 4))
}

function getTrimmedEnv(name: string): string | null {
  const value = process.env[name]?.trim()
  return value ? value : null
}

function parseStringArrayEnv(name: string): string[] {
  const raw = getTrimmedEnv(name)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed
    }
  } catch {
    // Fall through to whitespace splitting.
  }

  return raw
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function parseStringRecordEnv(name: string): Record<string, string> | undefined {
  const raw = getTrimmedEnv(name)
  if (!raw) {
    return undefined
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined
    }

    const entries = Object.entries(parsed).filter((entry): entry is [string, string] => {
      const [, value] = entry
      return typeof value === 'string'
    })

    return Object.fromEntries(entries)
  } catch {
    return undefined
  }
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

function toStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const entries = Object.entries(value).filter((entry): entry is [string, string] => {
    const [, recordValue] = entry
    return typeof recordValue === 'string'
  })

  return Object.fromEntries(entries)
}

async function readWorkspaceMcpConfig(): Promise<TestwallMcpConfig> {
  try {
    const raw = await readFile(WORKSPACE_MCP_JSON_PATH, 'utf8')
    const parsed = JSON.parse(raw) as WorkspaceMcpJson
    const server = parsed.servers?.[WORKSPACE_MCP_SERVER_ID]

    if (!server) {
      return { transport: 'none' }
    }

    if (server.type === 'stdio' && typeof server.command === 'string' && server.command.trim()) {
      return {
        transport: 'stdio',
        command: server.command,
        args: toStringArray(server.args),
        cwd: typeof server.cwd === 'string' && server.cwd.trim() ? server.cwd : undefined,
        env: toStringRecord(server.env),
      }
    }

    if (server.type === 'http' && typeof server.url === 'string' && server.url.trim()) {
      return {
        transport: 'streamable-http',
        url: server.url,
        headers: toStringRecord(server.headers),
      }
    }
  } catch (error) {
    console.warn('Failed to read workspace MCP configuration for Agent page:', error)
  }

  return { transport: 'none' }
}

async function getTestwallMcpConfig(): Promise<TestwallMcpConfig> {
  const transport = getTrimmedEnv('TESTWALL_MCP_TRANSPORT')?.toLowerCase()

  if (transport === 'stdio') {
    const command = getTrimmedEnv('TESTWALL_MCP_COMMAND')
    if (!command) {
      return { transport: 'none' }
    }

    return {
      transport: 'stdio',
      command,
      args: parseStringArrayEnv('TESTWALL_MCP_ARGS'),
      cwd: getTrimmedEnv('TESTWALL_MCP_CWD') ?? undefined,
      env: parseStringRecordEnv('TESTWALL_MCP_ENV'),
    }
  }

  const url = getTrimmedEnv('TESTWALL_MCP_URL')
  if (transport === 'streamable-http' || url) {
    if (!url) {
      return { transport: 'none' }
    }

    return {
      transport: 'streamable-http',
      url,
      headers: parseStringRecordEnv('TESTWALL_MCP_HEADERS'),
    }
  }

  return await readWorkspaceMcpConfig()
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function splitPathEnv(pathEnv: string | undefined): string[] {
  if (!pathEnv) {
    return []
  }

  return pathEnv
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

async function resolveCommandFromPath(
  command: string,
  env?: Record<string, string>,
): Promise<string | null> {
  if (path.isAbsolute(command)) {
    return (await fileExists(command)) ? command : null
  }

  if (command.includes('/') || command.includes('\\')) {
    const resolved = path.resolve(env?.PWD ?? process.cwd(), command)
    return (await fileExists(resolved)) ? resolved : null
  }

  const pathEntries = splitPathEnv(env?.PATH ?? process.env.PATH)

  for (const entry of pathEntries) {
    const candidate = path.join(entry, command)
    if (await fileExists(candidate)) {
      return candidate
    }

    if (process.platform === 'win32') {
      for (const extension of ['.exe', '.cmd', '.bat']) {
        const windowsCandidate = `${candidate}${extension}`
        if (await fileExists(windowsCandidate)) {
          return windowsCandidate
        }
      }
    }
  }

  return null
}

async function resolveUvxFallback(config: Extract<TestwallMcpConfig, { transport: 'stdio' }>) {
  if (config.command !== 'uvx') {
    return config
  }

  const env = config.env
  const resolvedUvx = await resolveCommandFromPath('uvx', env)
  if (resolvedUvx) {
    return {
      ...config,
      command: resolvedUvx,
    }
  }

  const homeDir = env?.HOME ?? env?.USERPROFILE ?? process.env.HOME ?? process.env.USERPROFILE
  if (homeDir) {
    for (const candidate of [
      path.join(homeDir, '.local', 'bin', 'uvx'),
      path.join(homeDir, '.cargo', 'bin', 'uvx'),
    ]) {
      if (await fileExists(candidate)) {
        return {
          ...config,
          command: candidate,
        }
      }
    }
  }

  const resolvedUv = await resolveCommandFromPath('uv', env)
  if (resolvedUv) {
    return {
      ...config,
      command: resolvedUv,
      args: ['tool', 'run', ...config.args],
    }
  }

  return config
}

async function resolveStdioConfig(config: Extract<TestwallMcpConfig, { transport: 'stdio' }>) {
  return await resolveUvxFallback(config)
}

function createMcpClient(): Client {
  return new Client(
    { name: 'TestwallBooker Agent', version: '1.0.0' },
    {
      capabilities: {},
    },
  )
}

async function withTestwallMcpClient<T>(
  config: Exclude<TestwallMcpConfig, { transport: 'none' }>,
  callback: (client: Client) => Promise<T>,
): Promise<T> {
  const client = createMcpClient()
  const transport =
    config.transport === 'stdio'
      ? (() => {
          const stdioConfig = config as Extract<TestwallMcpConfig, { transport: 'stdio' }>
          return resolveStdioConfig(stdioConfig).then(
            (resolved) =>
              new StdioClientTransport({
                command: resolved.command,
                args: resolved.args,
                cwd: resolved.cwd,
                env: resolved.env,
              }),
          )
        })()
      : Promise.resolve(
          new StreamableHTTPClientTransport(new URL(config.url), {
            requestInit: config.headers ? { headers: config.headers } : undefined,
          }),
        )

  const resolvedTransport = await transport

  await client.connect(resolvedTransport)

  try {
    return await callback(client)
  } finally {
    await resolvedTransport.close()
  }
}

function getHistoryTranscript(history: AgentChatMessage[]): string {
  return history
    .slice(-8)
    .map((item) => `${item.role}: ${item.content}`)
    .join('\n')
}

function isLikelyQuestionField(fieldName: string): boolean {
  return /question|query|request|prompt|task|goal|operation|instruction|message|input/i.test(
    fieldName,
  )
}

function isLikelyConversationField(fieldName: string): boolean {
  return /history|conversation|context|messages/i.test(fieldName)
}

function getSchemaProperty(tool: Tool, key: string): JsonObject | null {
  const value = tool.inputSchema.properties?.[key]
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as JsonObject
}

function getSchemaPropertyDescription(tool: Tool, key: string): string | null {
  const description = getSchemaProperty(tool, key)?.description
  return typeof description === 'string' && description.trim() ? description.trim() : null
}

function isContentBlock(value: unknown): value is ContentBlock {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const type = (value as { type?: unknown }).type
  return typeof type === 'string'
}

function toContentBlocks(value: unknown): ContentBlock[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isContentBlock)
}

function summarizeTextContent(content: unknown): string {
  const blocks = toContentBlocks(content)

  const textBlocks = blocks
    .filter((item): item is Extract<ContentBlock, { type: 'text' }> => item.type === 'text')
    .map((item) => item.text.trim())
    .filter((item) => item.length > 0)

  if (textBlocks.length > 0) {
    return textBlocks.join('\n\n')
  }

  const resourceLinks = blocks
    .filter(
      (item): item is Extract<ContentBlock, { type: 'resource_link' }> =>
        item.type === 'resource_link',
    )
    .map((item) => `${item.name}: ${item.uri}`)

  if (resourceLinks.length > 0) {
    return resourceLinks.join('\n')
  }

  return 'The Testwall MCP server returned no text content.'
}

function summarizeTools(tools: Tool[]): string {
  if (tools.length === 0) {
    return 'The configured Testwall MCP server is connected, but it does not currently expose any tools.'
  }

  return [
    'The Testwall MCP server is connected. Available tools:',
    ...tools.map((tool) => {
      const description = tool.description?.trim()
      return description ? `- ${tool.name}: ${description}` : `- ${tool.name}`
    }),
  ].join('\n')
}

function buildClarificationMessage(tool: Tool, missingKeys: string[]): string {
  const lines = [
    `I connected to the Testwall MCP server, but the selected tool \`${tool.name}\` needs more input before I can call it.`,
  ]

  for (const key of missingKeys) {
    const description = getSchemaPropertyDescription(tool, key)
    lines.push(description ? `- ${key}: ${description}` : `- ${key}`)
  }

  return lines.join('\n')
}

function findToolByPriority(tools: Tool[], names: string[]): Tool | null {
  for (const name of names) {
    const match = tools.find((tool) => tool.name.toLowerCase() === name.toLowerCase())
    if (match) {
      return match
    }
  }

  return null
}

function extractLikelyTestwall(text: string): string | null {
  const normalized = text.trim()
  if (!normalized) {
    return null
  }

  // Typical names like TTC2700, TW-01, TWC001.
  const directMatch = normalized.match(/\b([A-Za-z]{2,}[-_]?[A-Za-z0-9]*\d{2,})\b/)
  if (directMatch) {
    return directMatch[1]
  }

  // Phrases like "testwall foo".
  const phraseMatch = normalized.match(/\btestwall\s+([A-Za-z0-9_-]{2,})\b/i)
  if (phraseMatch) {
    return phraseMatch[1]
  }

  return null
}

function inferTestwallFromConversation(
  message: string,
  history: AgentChatMessage[],
): string | null {
  const fromMessage = extractLikelyTestwall(message)
  if (fromMessage) {
    return fromMessage
  }

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index]
    if (item.role !== 'user') {
      continue
    }

    const candidate = extractLikelyTestwall(item.content)
    if (candidate) {
      return candidate
    }
  }

  return null
}

function inferGuideTopic(message: string): string | null {
  const normalized = message.toLowerCase()

  if (/waldie|ewald|pin/.test(normalized)) {
    return 'waldies'
  }

  if (/can\b|pcan/.test(normalized)) {
    return 'can'
  }

  if (/flash|flashing/.test(normalized)) {
    return 'flashing'
  }

  if (/power|voltage|current/.test(normalized)) {
    return 'power'
  }

  if (/pitfall|error|issue/.test(normalized)) {
    return 'pitfalls'
  }

  return null
}

function selectTool(tools: Tool[], message: string): Tool | null {
  const normalized = message.trim().toLowerCase()

  if (/\b(list|show|available)\b.*\btestwalls\b|\bwhat testwalls\b/.test(normalized)) {
    return findToolByPriority(tools, ['list_testwalls'])
  }

  if (/\b(list|show|available)\b.*\bduts\b|\bwhat duts\b/.test(normalized)) {
    return findToolByPriority(tools, ['list_duts'])
  }

  return findToolByPriority(tools, ['get_api_guide', 'get_testwall', 'get_dut']) ?? tools[0] ?? null
}

function buildToolInvocationPlan(
  tool: Tool,
  message: string,
  history: AgentChatMessage[],
): ToolInvocationPlan {
  const args: JsonObject = {}
  const requiredKeys = new Set(tool.inputSchema.required ?? [])
  const inferredTestwall = inferTestwallFromConversation(message, history)

  for (const key of Object.keys(tool.inputSchema.properties ?? {})) {
    if (key.toLowerCase() === 'testwall' && inferredTestwall) {
      args[key] = inferredTestwall
      requiredKeys.delete(key)
      continue
    }

    if (tool.name === 'get_api_guide' && key.toLowerCase() === 'topic') {
      const topic = inferGuideTopic(message)
      if (topic) {
        args[key] = topic
      }
      continue
    }

    if (isLikelyQuestionField(key)) {
      args[key] = message
      requiredKeys.delete(key)
      continue
    }

    if (isLikelyConversationField(key)) {
      const transcript = getHistoryTranscript(history)
      if (transcript) {
        args[key] = transcript
        requiredKeys.delete(key)
      }
    }
  }

  const missingKeys = [...requiredKeys]
  if (missingKeys.length > 0) {
    return {
      type: 'clarify',
      message: buildClarificationMessage(tool, missingKeys),
    }
  }

  return {
    type: 'call-tool',
    tool,
    arguments: args,
  }
}

function findArithmeticExpression(input: string): string | null {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/,/g, '')
    .replace(/^(what is|calculate|compute|solve|evaluate)\s+/i, '')
    .replace(/[?.!]+$/g, '')
    .trim()

  const matches = normalized.match(/[-+*/%().\d\s]+/g)
  if (!matches) {
    return null
  }

  const candidate = matches
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .sort((left, right) => right.length - left.length)[0]

  if (!candidate) {
    return null
  }

  if (!/[\d]/.test(candidate) || /[^0-9+\-*/%().\s]/.test(candidate)) {
    return null
  }

  return candidate
}

function evaluateArithmeticExpression(expression: string): number | null {
  try {
    const result = Function(`'use strict'; return (${expression})`)() as unknown
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      return null
    }

    return result
  } catch {
    return null
  }
}

function buildMathReply(message: string): string {
  const expression = findArithmeticExpression(message)
  if (!expression) {
    return 'No Testwall MCP server is configured yet, so the fallback runner can only handle arithmetic. Ask something like "(12 + 8) / 5" or configure TESTWALL_MCP_TRANSPORT on the backend.'
  }

  const result = evaluateArithmeticExpression(expression)
  if (result === null) {
    return 'I could not evaluate that arithmetic expression. Try a simpler expression using numbers, parentheses, and + - * / %.'
  }

  return `${expression} = ${Number.isInteger(result) ? result : result.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}`
}

async function runTestwallMcpMessage(input: {
  message: string
  history: AgentChatMessage[]
}): Promise<AgentRunResult | null> {
  const config = await getTestwallMcpConfig()
  if (config.transport === 'none') {
    return null
  }

  try {
    const reply = await withTestwallMcpClient(config, async (client) => {
      const { tools } = await client.listTools()
      const selectedTool = selectTool(tools, input.message)

      if (!selectedTool) {
        return summarizeTools(tools)
      }

      const plan = buildToolInvocationPlan(selectedTool, input.message, input.history)
      if (plan.type === 'clarify') {
        return plan.message
      }

      const result = await client.callTool({
        name: plan.tool.name,
        arguments: plan.arguments,
      })

      return summarizeTextContent(result.content)
    })

    const historyBudget = input.history
      .slice(-10)
      .map((item) => item.content)
      .join('\n')
    const promptTokens = estimateTokenCount(historyBudget) + estimateTokenCount(input.message)
    const completionTokens = estimateTokenCount(reply)

    return {
      mode: 'testwall-mcp',
      reply,
      promptTokens,
      completionTokens,
      provider: 'testwall-mcp',
      builderTunnelReady: false,
      configuredAgentName: CONFIGURED_AGENT_NAME,
      runtimeSupportsCustomAgent: true,
      mcpReady: true,
      mcpTransport: config.transport,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const reply = `The website agent tried to connect to the Testwall MCP server but failed: ${message}`

    return {
      mode: 'testwall-mcp',
      reply,
      promptTokens: estimateTokenCount(input.message),
      completionTokens: estimateTokenCount(reply),
      provider: 'testwall-mcp',
      builderTunnelReady: false,
      configuredAgentName: CONFIGURED_AGENT_NAME,
      runtimeSupportsCustomAgent: true,
      mcpReady: false,
      mcpTransport: config.transport,
    }
  }
}

export async function runAgentMessage(input: {
  message: string
  history: AgentChatMessage[]
}): Promise<AgentRunResult> {
  const testwallMcpResult = await runTestwallMcpMessage(input)
  if (testwallMcpResult) {
    return testwallMcpResult
  }

  const builderTunnelReady = getBuilderClient() !== null

  if (builderTunnelReady) {
    try {
      await getBuilderClient()?.RefreshTokenIfNeeded()
    } catch (error) {
      console.warn('Copilot SDK builder token refresh failed, using math fallback:', error)
    }
  }

  const historyBudget = input.history
    .slice(-10)
    .map((item) => item.content)
    .join('\n')
  const promptTokens = estimateTokenCount(historyBudget) + estimateTokenCount(input.message)
  const reply = buildMathReply(input.message)
  const completionTokens = estimateTokenCount(reply)

  return {
    mode: 'math-only',
    reply,
    promptTokens,
    completionTokens,
    provider: builderTunnelReady ? 'copilot-sdk-auth-ready' : 'math-fallback',
    builderTunnelReady,
    configuredAgentName: CONFIGURED_AGENT_NAME,
    runtimeSupportsCustomAgent: false,
    mcpReady: false,
    mcpTransport: 'none',
  }
}
