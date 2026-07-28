import { Router } from 'express'
import { pool } from '../db'
import type { Request, Response } from 'express'

const router = Router()

// Get all access rights/roles
router.get('/', async (_req: Request, res: Response) => {
  const [rows] = await pool.execute('SELECT id, role_name, description FROM access_rights')
  res.json(rows)
})

// Get access rights for a user
router.get('/user/:user_id', async (req: Request, res: Response) => {
  const { user_id } = req.params
  const [rows] = await pool.execute(
    `SELECT ar.id, ar.role_name, ar.description 
     FROM access_rights ar
     INNER JOIN user_access_rights uar ON ar.id = uar.access_right_id
     WHERE uar.user_id = ?`,
    [user_id],
  )
  res.json(rows)
})

// Assign access right to user
router.post('/assign', async (req: Request, res: Response) => {
  const { user_id, access_right_id } = req.body
  if (!user_id || !access_right_id) {
    res.status(400).json({ error: 'user_id and access_right_id are required' })
    return
  }

  try {
    await pool.execute('INSERT INTO user_access_rights (user_id, access_right_id) VALUES (?, ?)', [
      user_id,
      access_right_id,
    ])
    res.status(201).json({ success: true })
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'User already has this access right' })
    } else {
      res.status(500).json({ error: 'Failed to assign access right' })
    }
  }
})

// Remove access right from user
router.delete('/revoke', async (req: Request, res: Response) => {
  const { user_id, access_right_id } = req.body
  if (!user_id || !access_right_id) {
    res.status(400).json({ error: 'user_id and access_right_id are required' })
    return
  }

  await pool.execute('DELETE FROM user_access_rights WHERE user_id = ? AND access_right_id = ?', [
    user_id,
    access_right_id,
  ])
  res.json({ success: true })
})

// Check if user has a specific role
router.post('/check', async (req: Request, res: Response) => {
  const { user_id, role_name } = req.body
  if (!user_id || !role_name) {
    res.status(400).json({ error: 'user_id and role_name are required' })
    return
  }

  const [rows] = await pool.execute(
    `SELECT COUNT(*) as count FROM user_access_rights uar
     INNER JOIN access_rights ar ON uar.access_right_id = ar.id
     WHERE uar.user_id = ? AND ar.role_name = ?`,
    [user_id, role_name],
  )

  const hasRole = (rows as any[])[0].count > 0
  res.json({ hasRole })
})

export default router
