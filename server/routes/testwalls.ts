import { Router } from 'express'
import { pool } from '../db'
import type { Request, Response } from 'express'

const router = Router()

// Fast overview payload: current availability and current user name only.
router.get('/overview', async (_req: Request, res: Response) => {
  const [rows] = await pool.execute(`
    SELECT
      t.id,
      t.name,
      t.ip_address,
      t.created_at,
      a.id AS active_user_id,
      a.username AS active_username,
      CASE WHEN b.id IS NULL THEN 'available' ELSE 'unavailable' END AS availability_status
    FROM testwalls t
    LEFT JOIN bookings b ON b.id = (
      SELECT b2.id
      FROM bookings b2
      WHERE b2.testwall_id = t.id
        AND b2.from_time <= NOW()
        AND NOW() < b2.to_time
        AND COALESCE(b2.status, 'active') = 'active'
      ORDER BY b2.from_time DESC
      LIMIT 1
    )
    LEFT JOIN accounts a ON a.id = b.user_id
    ORDER BY t.name
  `)

  const mapped = (rows as any[]).map((row) => ({
    id: row.id,
    name: row.name,
    ip_address: row.ip_address,
    created_at: row.created_at,
    current_user_id: row.active_user_id ?? null,
    current_user: row.active_username ?? null,
    availability_status: row.availability_status,
  }))

  res.json(mapped)
})

// Get all testwalls
router.get('/', async (_req: Request, res: Response) => {
  const [rows] = await pool.execute(
    'SELECT id, name, ip_address, created_at FROM testwalls ORDER BY name',
  )
  res.json(rows)
})

// Get testwall by ID
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const [rows] = await pool.execute(
    'SELECT id, name, ip_address, created_at FROM testwalls WHERE id = ?',
    [id],
  )
  if ((rows as any[]).length === 0) {
    res.status(404).json({ error: 'Testwall not found' })
    return
  }
  res.json((rows as any[])[0])
})

// Create testwall
router.post('/', async (req: Request, res: Response) => {
  const { name, ip_address } = req.body
  if (!name || !ip_address) {
    res.status(400).json({ error: 'name and ip_address are required' })
    return
  }

  await pool.execute('INSERT INTO testwalls (name, ip_address) VALUES (?, ?)', [name, ip_address])
  const [result] = await pool.execute('SELECT LAST_INSERT_ID() as id')
  res.status(201).json((result as any[])[0])
})

// Update testwall
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const { name, ip_address } = req.body

  await pool.execute('UPDATE testwalls SET name = ?, ip_address = ? WHERE id = ?', [
    name,
    ip_address,
    id,
  ])
  res.json({ success: true })
})

// Delete testwall
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  await pool.execute('DELETE FROM testwalls WHERE id = ?', [id])
  res.json({ success: true })
})

export default router
