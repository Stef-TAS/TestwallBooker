import { Router } from 'express'
import { pool } from '../db'
import type { Request, Response } from 'express'

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  const { user_id, command } = req.body as { user_id?: number; command?: string }
  if (!user_id || !command) {
    res.status(400).json({ error: 'user_id and command are required' })
    return
  }
  await pool.execute('INSERT INTO command_history (user_id, command) VALUES (?, ?)', [
    user_id,
    command,
  ])
  res.status(201).json({ success: true })
})

router.get('/:user_id', async (req: Request, res: Response) => {
  const { user_id } = req.params
  const [rows] = await pool.execute(
    'SELECT command, executed_at FROM command_history WHERE user_id = ? ORDER BY executed_at DESC LIMIT 100',
    [user_id],
  )
  res.json(rows)
})

export default router
