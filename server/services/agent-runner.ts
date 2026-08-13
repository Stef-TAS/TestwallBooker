import { Copilot } from 'copilot-sdk'

export type AgentChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type AgentRunResult = {
  reply: string
  promptTokens: number
  completionTokens: number
  provider: 'math-fallback' | 'copilot-sdk-auth-ready'
  builderTunnelReady: boolean
}

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
    return 'The temporary agent is limited to arithmetic. Ask something like "(12 + 8) / 5" or "calculate 17 * 9".'
  }

  const result = evaluateArithmeticExpression(expression)
  if (result === null) {
    return 'I could not evaluate that arithmetic expression. Try a simpler expression using numbers, parentheses, and + - * / %.'
  }

  return `${expression} = ${Number.isInteger(result) ? result : result.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}`
}

export async function runAgentMessage(input: {
  message: string
  history: AgentChatMessage[]
}): Promise<AgentRunResult> {
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
    reply,
    promptTokens,
    completionTokens,
    provider: builderTunnelReady ? 'copilot-sdk-auth-ready' : 'math-fallback',
    builderTunnelReady,
  }
}
