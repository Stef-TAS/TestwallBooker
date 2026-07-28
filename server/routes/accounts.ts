import { Router } from 'express'
import { pool } from '../db'
import type { Request, Response } from 'express'

const router = Router()

// Get all accounts (admin only)
router.get('/', async (_req: Request, res: Response) => {
  const [rows] = await pool.execute(
    'SELECT id, username, email, first_name, last_name, location, timezone, created_at FROM accounts',
  )
  res.json(rows)
})

// Get account by ID
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const [rows] = await pool.execute(
    'SELECT id, username, email, first_name, last_name, location, timezone, created_at FROM accounts WHERE id = ?',
    [id],
  )
  if ((rows as any[]).length === 0) {
    res.status(404).json({ error: 'Account not found' })
    return
  }
  res.json((rows as any[])[0])
})

// Create account (register)
router.post('/register', async (req: Request, res: Response) => {
  const { username, email, password, first_name, last_name, location, timezone } = req.body
  if (!username || !email || !password) {
    res.status(400).json({ error: 'username, email, and password are required' })
    return
  }

  try {
    // TODO: Hash password with bcrypt before storing
    await pool.execute(
      'INSERT INTO accounts (username, email, password_hash, first_name, last_name, location, timezone) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        username,
        email,
        password,
        first_name ?? null,
        last_name ?? null,
        location ?? null,
        timezone ?? null,
      ],
    )
    const [newAccount] = await pool.execute('SELECT id FROM accounts WHERE username = ?', [
      username,
    ])
    res.status(201).json((newAccount as any[])[0])
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Username or email already exists' })
    } else {
      res.status(500).json({ error: 'Failed to create account' })
    }
  }
})

// Update account
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const { first_name, last_name, location, timezone, profile_picture } = req.body

  await pool.execute(
    'UPDATE accounts SET first_name = ?, last_name = ?, location = ?, timezone = ?, profile_picture = ? WHERE id = ?',
    [
      first_name ?? null,
      last_name ?? null,
      location ?? null,
      timezone ?? null,
      profile_picture ?? null,
      id,
    ],
  )
  res.json({ success: true })
})

// Delete account
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  await pool.execute('DELETE FROM accounts WHERE id = ?', [id])
  res.json({ success: true })
})

export default router
