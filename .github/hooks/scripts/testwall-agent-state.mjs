#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const STATE_FILE = path.join(process.cwd(), '.github', 'logs', 'testwall-mcp-guide-state.json')
const TARGET_AGENT_NAMES = new Set(['Testwall MCP Guide', 'testwall-mcp-guide'])

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

function isTargetAgent(payload) {
  const agentName = findFirstString(payload, [
    ['agentName'],
    ['agent', 'name'],
    ['metadata', 'agentName'],
    ['context', 'agentName'],
    ['input', 'agentName'],
  ])

  if (!agentName) {
    return false
  }

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

function main() {
  const mode = process.argv[2] || 'prompt'
  if (mode !== 'prompt') {
    process.exit(0)
  }

  const payload = readStdinJson()
  if (!isTargetAgent(payload)) {
    process.exit(0)
  }

  const sessionId = findFirstString(payload, [
    ['sessionId'],
    ['context', 'sessionId'],
    ['metadata', 'sessionId'],
  ])

  if (!sessionId) {
    process.exit(0)
  }

  const state = readState()
  state.sessions[sessionId] = {
    needsConfluence: true,
    updatedAt: new Date().toISOString(),
  }

  writeState(state)
  process.exit(0)
}

main()
