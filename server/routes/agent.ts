import { Router } from 'express'
import type { Request, Response } from 'express'
import { pool } from '../db'
import {
  runAgentMessage,
  type AgentChatMessage,
  estimateTokenCount,
} from '../services/agent-runner'

const router = Router()
const DAILY_TOKEN_LIMIT = Number(process.env.AGENT_DAILY_TOKEN_LIMIT ?? 6000)
const MAX_MESSAGE_LENGTH = Number(process.env.AGENT_MAX_MESSAGE_CHARS ?? 2000)
const MAX_HISTORY_ITEMS = 20

type AccountCookie = {
  id: number
}

function isAgentChatMessage(value: unknown): value is AgentChatMessage {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<AgentChatMessage>
  return (
    (candidate.role === 'user' || candidate.role === 'assistant') &&
    typeof candidate.content === 'string'
  )
}

function parseCookieValue(req: Request, name: string): string | null {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) {
    return null
  }

  const entry = cookieHeader
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`))

  if (!entry) {
    return null
  }

  return entry.slice(name.length + 1)
}

function readAccountFromCookie(req: Request): AccountCookie | null {
  const rawCookie = parseCookieValue(req, 'account')
  if (!rawCookie) {
    return null
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(rawCookie)) as Partial<AccountCookie>
    const id = Number(parsed.id)
    if (!Number.isInteger(id) || id <= 0) {
      return null
    }

    return { id }
  } catch {
    return null
  }
}

async function getAgentAccess(userId: number) {
  const [rows] = await pool.execute(
    `SELECT ar.id, ar.role_name FROM access_rights ar
     INNER JOIN user_access_rights uar ON ar.id = uar.access_right_id
     WHERE uar.user_id = ?`,
    [userId],
  )

  const roles = (rows as any[]).map((row) => String(row.role_name).toLowerCase())
  const roleIds = new Set((rows as any[]).map((row) => Number(row.id)))
  const hasOperatorRole = roles.includes('operator')
  const isUserOnly = (rows as any[]).length === 1 && (roles.includes('user') || roleIds.has(2))

  return {
    isAdmin: roles.includes('admin') || roleIds.has(1),
    canTestwall: hasOperatorRole && !isUserOnly,
  }
}

async function getTodaysUsage(userId: number) {
  const [rows] = await pool.execute(
    `SELECT request_count, prompt_tokens, completion_tokens, total_tokens
     FROM agent_usage_daily
     WHERE user_id = ? AND usage_date = CURDATE()`,
    [userId],
  )

  const row = (rows as any[])[0]
  if (!row) {
    return {
      requestCount: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    }
  }

  return {
    requestCount: Number(row.request_count ?? 0),
    promptTokens: Number(row.prompt_tokens ?? 0),
    completionTokens: Number(row.completion_tokens ?? 0),
    totalTokens: Number(row.total_tokens ?? 0),
  }
}

async function requireAgentUser(req: Request, res: Response) {
  const account = readAccountFromCookie(req)
  if (!account) {
    res.status(401).json({ error: 'Login required' })
    return null
  }

  const access = await getAgentAccess(account.id)
  if (!access.isAdmin && !access.canTestwall) {
    res.status(403).json({ error: 'Agent access is limited to admins and operators' })
    return null
  }

  return { account, access }
}

router.get('/quota', async (req: Request, res: Response) => {
  const user = await requireAgentUser(req, res)
  if (!user) {
    return
  }

  const usage = await getTodaysUsage(user.account.id)
  res.json({
    dailyLimit: DAILY_TOKEN_LIMIT,
    usedTokens: usage.totalTokens,
    remainingTokens: Math.max(DAILY_TOKEN_LIMIT - usage.totalTokens, 0),
    requestCount: usage.requestCount,
    builderAccount: 'shared-builder',
  })
})

router.post('/chat', async (req: Request, res: Response) => {
  const user = await requireAgentUser(req, res)
  if (!user) {
    return
  }

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
  const rawHistory: unknown[] = Array.isArray(req.body?.history) ? req.body.history : []
  const history = rawHistory.slice(-MAX_HISTORY_ITEMS).filter(isAgentChatMessage)

  if (!message) {
    res.status(400).json({ error: 'Message is required' })
    return
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({
      error: `Message is too long. Limit is ${MAX_MESSAGE_LENGTH} characters.`,
    })
    return
  }

  const usage = await getTodaysUsage(user.account.id)
  const estimatedPromptTokens = estimateTokenCount(
    `${history.map((item: AgentChatMessage) => item.content).join('\n')}\n${message}`,
  )

  if (usage.totalTokens + estimatedPromptTokens >= DAILY_TOKEN_LIMIT) {
    res.status(429).json({
      error:
        'Daily token budget reached for this account. Try again tomorrow or ask an admin to raise the limit.',
      quota: {
        dailyLimit: DAILY_TOKEN_LIMIT,
        usedTokens: usage.totalTokens,
        remainingTokens: Math.max(DAILY_TOKEN_LIMIT - usage.totalTokens, 0),
        requestCount: usage.requestCount,
      },
    })
    return
  }

  const result = await runAgentMessage({ message, history })
  const totalTokens = result.promptTokens + result.completionTokens

  await pool.execute(
    `INSERT INTO agent_usage_daily (
       user_id,
       usage_date,
       request_count,
       prompt_tokens,
       completion_tokens,
       total_tokens
     ) VALUES (?, CURDATE(), 1, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       request_count = request_count + 1,
       prompt_tokens = prompt_tokens + VALUES(prompt_tokens),
       completion_tokens = completion_tokens + VALUES(completion_tokens),
       total_tokens = total_tokens + VALUES(total_tokens)`,
    [user.account.id, result.promptTokens, result.completionTokens, totalTokens],
  )

  const nextUsage = await getTodaysUsage(user.account.id)

  res.json({
    message: {
      role: 'assistant',
      content: result.reply,
    },
    quota: {
      dailyLimit: DAILY_TOKEN_LIMIT,
      usedTokens: nextUsage.totalTokens,
      remainingTokens: Math.max(DAILY_TOKEN_LIMIT - nextUsage.totalTokens, 0),
      requestCount: nextUsage.requestCount,
    },
    agent: {
      mode: 'math-only',
      provider: result.provider,
      builderTunnelReady: result.builderTunnelReady,
    },
  })
})

export default router
