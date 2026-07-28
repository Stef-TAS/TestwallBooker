import { Router } from 'express'
import { pool } from '../db'
import type { Request, Response } from 'express'

const router = Router()

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
