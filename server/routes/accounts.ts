import { Router } from 'express'
import { pool } from '../db'
import bcrypt from 'bcryptjs'
import type { Request, Response } from 'express'

const router = Router()
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12)

function normalizeProfilePicture(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('utf8')
  }

  if (typeof value === 'string') {
    return value
  }

  return null
}

function mapAccount(row: any) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    location: row.location,
    timezone: row.timezone,
    profilePicture: normalizeProfilePicture(row.profile_picture),
    createdAt: row.created_at,
  }
}

// Get profile pictures for a set of account ids.
router.get('/profile-pictures', async (req: Request, res: Response) => {
  const idsParam = String(req.query.ids ?? '').trim()
  if (!idsParam) {
    res.json({})
    return
  }

  const ids = idsParam
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)

  if (ids.length === 0) {
    res.json({})
    return
  }

  const placeholders = ids.map(() => '?').join(',')
  const [rows] = await pool.execute(
    `SELECT id, profile_picture FROM accounts WHERE id IN (${placeholders})`,
    ids,
  )

  const result: Record<number, string | null> = {}
  for (const row of rows as any[]) {
    result[row.id] = normalizeProfilePicture(row.profile_picture)
  }

  res.json(result)
})

// Get all accounts (admin only)
router.get('/', async (_req: Request, res: Response) => {
  const [rows] = await pool.execute(
    'SELECT id, username, email, first_name, last_name, location, timezone, profile_picture, created_at FROM accounts',
  )
  res.json((rows as any[]).map(mapAccount))
})

// Get account by ID
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const [rows] = await pool.execute(
    'SELECT id, username, email, first_name, last_name, location, timezone, profile_picture, created_at FROM accounts WHERE id = ?',
    [id],
  )
  if ((rows as any[]).length === 0) {
    res.status(404).json({ error: 'Account not found' })
    return
  }
  res.json(mapAccount((rows as any[])[0]))
})

// Create account (register)
router.post('/register', async (req: Request, res: Response) => {
  const { username, email, password, first_name, last_name, location, timezone } = req.body
  if (!username || !email || !password) {
    res.status(400).json({ error: 'username, email, and password are required' })
    return
  }

  try {
    const passwordHash = await bcrypt.hash(String(password), BCRYPT_ROUNDS)

    await pool.execute(
      'INSERT INTO accounts (username, email, password_hash, first_name, last_name, location, timezone) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        username,
        email,
        passwordHash,
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
  const updates: string[] = []
  const values: (string | number | Buffer | null)[] = []

  if (Object.prototype.hasOwnProperty.call(req.body, 'first_name')) {
    updates.push('first_name = ?')
    values.push(req.body.first_name ?? null)
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'last_name')) {
    updates.push('last_name = ?')
    values.push(req.body.last_name ?? null)
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'location')) {
    updates.push('location = ?')
    values.push(req.body.location ?? null)
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'timezone')) {
    updates.push('timezone = ?')
    values.push(req.body.timezone ?? null)
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'profile_picture')) {
    updates.push('profile_picture = ?')
    const profilePicture = req.body.profile_picture
    values.push(profilePicture === null ? null : Buffer.from(String(profilePicture), 'utf8'))
  }

  if (updates.length === 0) {
    res.json({ success: true })
    return
  }

  values.push(id as string)
  await pool.execute(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`, values)
  res.json({ success: true })
})

router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  await pool.execute('DELETE FROM accounts WHERE id = ?', [id])
  res.json({ success: true })
})

export default router
