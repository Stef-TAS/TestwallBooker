import { Router } from 'express'
import { pool } from '../db'
import type { Request, Response } from 'express'

const router = Router()

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

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }

  try {
    // Find user by email
    const [users] = await pool.execute(
      'SELECT id, username, email, first_name, last_name, location, timezone, profile_picture FROM accounts WHERE email = ?',
      [email],
    )

    if ((users as any[]).length === 0) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const user = (users as any[])[0]

    // TODO: Use bcrypt to verify password hash
    // For now, compare plain text (NOT SECURE - fix this!)
    const [passwordCheck] = await pool.execute(
      'SELECT password_hash FROM accounts WHERE email = ? AND password_hash = ?',
      [email, password],
    )

    if ((passwordCheck as any[]).length === 0) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    // Get user's access rights
    const [accessRights] = await pool.execute(
      `SELECT ar.id, ar.role_name FROM access_rights ar
       INNER JOIN user_access_rights uar ON ar.id = uar.access_right_id
       WHERE uar.user_id = ?`,
      [user.id],
    )

    const roles = (accessRights as any[]).map((row) => String(row.role_name).toLowerCase())
    const roleIds = new Set((accessRights as any[]).map((row) => Number(row.id)))

    const hasOperatorRole = roles.includes('operator')
    const isUserOnly =
      (accessRights as any[]).length === 1 && (roles.includes('user') || roleIds.has(2))

    // Build account object
    const account = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      location: user.location,
      timezone: user.timezone,
      profilePicture: normalizeProfilePicture(user.profile_picture),
      isAdmin: roles.includes('admin') || roleIds.has(1),
      canTestwall: hasOperatorRole && !isUserOnly,
    }

    res.json({ success: true, account })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

export default router
