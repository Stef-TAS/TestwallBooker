import { Router } from 'express'
import { pool } from '../db'
import type { Request, Response } from 'express'

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  const { user_id, action, details } = req.body as {
    user_id?: number
    action?: string
    details?: string
  }
  if (!action) {
    res.status(400).json({ error: 'action is required' })
    return
  }
  const ip = req.ip ?? req.socket.remoteAddress ?? null
  await pool.execute(
    'INSERT INTO logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
    [user_id ?? null, action, details ?? null, ip],
  )
  res.status(201).json({ success: true })
})

router.get('/', async (_req: Request, res: Response) => {
  const [rows] = await pool.execute(
    'SELECT l.*, a.username FROM logs l LEFT JOIN accounts a ON l.user_id = a.id ORDER BY l.created_at DESC LIMIT 500',
  )
  res.json(rows)
})

router.get('/:user_id', async (req: Request, res: Response) => {
  const { user_id } = req.params
  const [rows] = await pool.execute(
    'SELECT l.*, a.username FROM logs l LEFT JOIN accounts a ON l.user_id = a.id WHERE l.user_id = ? ORDER BY l.created_at DESC LIMIT 100',
    [user_id],
  )
  res.json(rows)
})

export default router
