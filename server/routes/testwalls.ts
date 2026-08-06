import { Router } from 'express'
import { pool } from '../db'
import type { Request, Response } from 'express'

const router = Router()

type MachineStatus = {
  name?: string
  ip?: string
  users?: string[]
  testing?: boolean
}

async function getLiveMachineUsersByKey() {
  const pythonStatusUrl = process.env.PYTHON_STATUS_URL ?? 'http://127.0.0.1:8080/api/machines'

  try {
    const response = await fetch(pythonStatusUrl, {
      signal: AbortSignal.timeout(2000),
    })

    if (!response.ok) {
      return {
        byIp: new Map<string, string[]>(),
        byName: new Map<string, string[]>(),
        knownIps: new Set<string>(),
        knownNames: new Set<string>(),
        testingIps: new Set<string>(),
        testingNames: new Set<string>(),
        serverReachable: false,
      }
    }

    const payload = (await response.json()) as { machines?: MachineStatus[] }
    const machines = Array.isArray(payload.machines) ? payload.machines : []

    const byIp = new Map<string, string[]>()
    const byName = new Map<string, string[]>()
    const knownIps = new Set<string>()
    const knownNames = new Set<string>()
    const testingIps = new Set<string>()
    const testingNames = new Set<string>()

    for (const machine of machines) {
      const users = Array.isArray(machine.users)
        ? machine.users.filter(
            (user): user is string => typeof user === 'string' && user.trim().length > 0,
          )
        : []
      const isTesting = machine.testing === true

      if (typeof machine.ip === 'string' && machine.ip.trim()) {
        knownIps.add(machine.ip.trim())
        if (users.length > 0) {
          byIp.set(machine.ip.trim(), users)
        }
        if (isTesting) {
          testingIps.add(machine.ip.trim())
        }
      }

      if (typeof machine.name === 'string' && machine.name.trim()) {
        knownNames.add(machine.name.trim().toLowerCase())
        if (users.length > 0) {
          byName.set(machine.name.trim().toLowerCase(), users)
        }
        if (isTesting) {
          testingNames.add(machine.name.trim().toLowerCase())
        }
      }
    }

    return { byIp, byName, knownIps, knownNames, testingIps, testingNames, serverReachable: true }
  } catch {
    return {
      byIp: new Map<string, string[]>(),
      byName: new Map<string, string[]>(),
      knownIps: new Set<string>(),
      knownNames: new Set<string>(),
      testingIps: new Set<string>(),
      testingNames: new Set<string>(),
      serverReachable: false,
    }
  }
}

// Fast overview payload: current availability and current user name only.
router.get('/overview', async (_req: Request, res: Response) => {
  const { byIp, byName, knownIps, knownNames, testingIps, testingNames, serverReachable } =
    await getLiveMachineUsersByKey()

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

  const mapped = (rows as any[]).map((row) => {
    const liveUsersByIp = byIp.get(row.ip_address)
    const liveUsersByName = byName.get(String(row.name).toLowerCase())
    const liveUsers = liveUsersByIp ?? liveUsersByName ?? []

    const isKnown =
      serverReachable &&
      (knownIps.has(row.ip_address) || knownNames.has(String(row.name).toLowerCase()))

    const isTesting =
      testingIps.has(row.ip_address) || testingNames.has(String(row.name).toLowerCase())

    const availabilityStatus: 'available' | 'unavailable' | 'out_of_service' = !isKnown
      ? 'out_of_service'
      : isTesting || row.availability_status === 'unavailable'
        ? 'unavailable'
        : 'available'

    return {
      id: row.id,
      name: row.name,
      ip_address: row.ip_address,
      created_at: row.created_at,
      current_user_id: row.active_user_id ?? null,
      current_user: row.active_username ?? null,
      current_users: liveUsers,
      availability_status: availabilityStatus,
    }
  })

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
