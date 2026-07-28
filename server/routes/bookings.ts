import { Router } from 'express'
import { pool } from '../db'
import type { Request, Response } from 'express'

const router = Router()

// Get all bookings
router.get('/', async (_req: Request, res: Response) => {
  const [rows] = await pool.execute(`
    SELECT b.id, b.testwall_id, b.user_id, b.from_time, b.to_time, 
           t.name as testwall_name, a.username
    FROM bookings b
    LEFT JOIN testwalls t ON b.testwall_id = t.id
    LEFT JOIN accounts a ON b.user_id = a.id
    ORDER BY b.from_time DESC
  `)
  res.json(rows)
})

// Get bookings by testwall ID
router.get('/testwall/:testwall_id', async (req: Request, res: Response) => {
  const { testwall_id } = req.params
  const [rows] = await pool.execute(
    `SELECT b.id, b.testwall_id, b.user_id, b.from_time, b.to_time, a.username
     FROM bookings b
     LEFT JOIN accounts a ON b.user_id = a.id
     WHERE b.testwall_id = ? ORDER BY b.from_time DESC`,
    [testwall_id],
  )
  res.json(rows)
})

// Get bookings by user ID
router.get('/user/:user_id', async (req: Request, res: Response) => {
  const { user_id } = req.params
  const [rows] = await pool.execute(
    `SELECT b.id, b.testwall_id, b.user_id, b.from_time, b.to_time, t.name as testwall_name
     FROM bookings b
     LEFT JOIN testwalls t ON b.testwall_id = t.id
     WHERE b.user_id = ? ORDER BY b.from_time DESC`,
    [user_id],
  )
  res.json(rows)
})

// Check if testwall is available for a time range
router.post('/check-availability', async (req: Request, res: Response) => {
  const { testwall_id, from_time, to_time } = req.body
  if (!testwall_id || !from_time || !to_time) {
    res.status(400).json({ error: 'testwall_id, from_time, and to_time are required' })
    return
  }

  const [rows] = await pool.execute(
    `SELECT COUNT(*) as count FROM bookings 
     WHERE testwall_id = ? 
     AND from_time < ? 
     AND to_time > ?`,
    [testwall_id, to_time, from_time],
  )

  const isAvailable = (rows as any[])[0].count === 0
  res.json({ available: isAvailable })
})

// Create booking
router.post('/', async (req: Request, res: Response) => {
  const { testwall_id, user_id, from_time, to_time } = req.body
  if (!testwall_id || !user_id || !from_time || !to_time) {
    res.status(400).json({ error: 'testwall_id, user_id, from_time, and to_time are required' })
    return
  }

  // Check availability
  const [conflicts] = await pool.execute(
    `SELECT COUNT(*) as count FROM bookings 
     WHERE testwall_id = ? 
     AND from_time < ? 
     AND to_time > ?`,
    [testwall_id, to_time, from_time],
  )

  if ((conflicts as any[])[0].count > 0) {
    res.status(409).json({ error: 'Testwall is not available for the requested time range' })
    return
  }

  await pool.execute(
    'INSERT INTO bookings (testwall_id, user_id, from_time, to_time) VALUES (?, ?, ?, ?)',
    [testwall_id, user_id, from_time, to_time],
  )
  const [result] = await pool.execute('SELECT LAST_INSERT_ID() as id')
  res.status(201).json((result as any[])[0])
})

// Update booking
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const { from_time, to_time } = req.body

  await pool.execute('UPDATE bookings SET from_time = ?, to_time = ? WHERE id = ?', [
    from_time,
    to_time,
    id,
  ])
  res.json({ success: true })
})

// Delete booking
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  await pool.execute('DELETE FROM bookings WHERE id = ?', [id])
  res.json({ success: true })
})

export default router
