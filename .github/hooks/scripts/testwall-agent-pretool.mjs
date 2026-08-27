#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const STATE_FILE = path.join(process.cwd(), '.github', 'logs', 'testwall-mcp-guide-state.json')
const TARGET_AGENT_NAMES = new Set(['Testwall MCP Guide', 'testwall-mcp-guide'])

const ALLOWED_EXACT = new Set(['vscode_askQuestions'])
const ALLOWED_PREFIXES = ['mcp_confluence_', 'mcp_testwall_mcp_']
const CONFLUENCE_PREFIX = 'mcp_confluence_'
const TESTWALL_PREFIX = 'mcp_testwall_mcp_'

function readStdinJson() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8') || '{}')
  } catch {
    return {}
  }
}

function getStringAtPath(obj, keys) {
  let cur = obj
  for (const key of keys) {
    if (!cur || typeof cur !== 'object' || !(key in cur)) {
      return ''
    }
    cur = cur[key]
  }
  return typeof cur === 'string' ? cur : ''
}

function findFirstString(obj, candidates) {
  for (const candidate of candidates) {
    const value = getStringAtPath(obj, candidate)
    if (value) {
      return value
    }
  }
  return ''
}

function findToolName(payload) {
  return findFirstString(payload, [
    ['toolName'],
    ['tool_name'],
    ['tool', 'name'],
    ['metadata', 'toolName'],
    ['context', 'toolName'],
    ['input', 'toolName'],
  ])
}

function findSessionId(payload) {
  return findFirstString(payload, [
    ['sessionId'],
    ['context', 'sessionId'],
    ['metadata', 'sessionId'],
  ])
}

function isTargetAgent(payload) {
  const agentName = findFirstString(payload, [
    ['agentName'],
    ['agent', 'name'],
    ['metadata', 'agentName'],
    ['context', 'agentName'],
    ['input', 'agentName'],
  ])

  return TARGET_AGENT_NAMES.has(agentName)
}

function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return { sessions: {} }
  }
}

function writeState(state) {
  ensureParentDirectory(STATE_FILE)
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8')
}

function emitAllow() {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
      },
    }),
  )
}

function emitDeny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
      stopReason: reason,
      systemMessage: reason,
    }),
  )
}

function hasAllowedPrefix(toolName) {
  return ALLOWED_PREFIXES.some((prefix) => toolName.startsWith(prefix))
}

function main() {
  const payload = readStdinJson()

  if (!isTargetAgent(payload)) {
    emitAllow()
    process.exit(0)
  }

  const toolName = findToolName(payload)
  if (!toolName) {
    emitAllow()
    process.exit(0)
  }

  if (!ALLOWED_EXACT.has(toolName) && !hasAllowedPrefix(toolName)) {
    emitDeny(
      'Testwall MCP Guide is restricted to Confluence MCP, Testwall MCP, and askQuestions only.',
    )
    process.exit(0)
  }

  const sessionId = findSessionId(payload)
  if (!sessionId) {
    emitAllow()
    process.exit(0)
  }

  const state = readState()
  const entry = state.sessions[sessionId] || { needsConfluence: true }

  if (toolName.startsWith(CONFLUENCE_PREFIX)) {
    entry.needsConfluence = false
    entry.updatedAt = new Date().toISOString()
    state.sessions[sessionId] = entry
    writeState(state)
    emitAllow()
    process.exit(0)
  }

  if (toolName.startsWith(TESTWALL_PREFIX) && entry.needsConfluence) {
    emitDeny(
      'Query Confluence MCP first to resolve the relevant testwall scope before calling Testwall MCP.',
    )
    process.exit(0)
  }

  emitAllow()
  process.exit(0)
}

main()
