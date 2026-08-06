import { Router } from 'express'
import { pool } from '../db'
import bcrypt from 'bcryptjs'
import type { Request, Response } from 'express'

const router = Router()
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12)

function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value)
}

async function verifyAndMigratePassword(
  userId: number,
  storedPasswordHash: string,
  passwordAttempt: string,
): Promise<boolean> {
  if (isBcryptHash(storedPasswordHash)) {
    return bcrypt.compare(passwordAttempt, storedPasswordHash)
  }

  if (storedPasswordHash !== passwordAttempt) {
    return false
  }

  try {
    // One-time migration path for legacy plaintext records.
    const upgradedHash = await bcrypt.hash(passwordAttempt, BCRYPT_ROUNDS)
    await pool.execute('UPDATE accounts SET password_hash = ? WHERE id = ?', [upgradedHash, userId])
  } catch (error) {
    console.warn(`Failed to migrate plaintext password for user ${userId}:`, error)
  }

  return true
}

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
      'SELECT id, username, email, password_hash, first_name, last_name, location, timezone, profile_picture FROM accounts WHERE email = ?',
      [email],
    )

    if ((users as any[]).length === 0) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const user = (users as any[])[0]

    const passwordValid = await verifyAndMigratePassword(
      Number(user.id),
      String(user.password_hash),
      password,
    )

    if (!passwordValid) {
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
