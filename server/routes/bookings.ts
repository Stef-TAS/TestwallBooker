import { Router } from 'express'
import { pool } from '../db'
import { isBookingEmailEnabled, sendBookingCreatedEmail } from '../email'
import type { Request, Response } from 'express'

const router = Router()
const MAX_BOOKING_DURATION_MS = 24 * 60 * 60 * 1000

function toMysqlDatetime(value: string): string {
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

function validateBookingWindow(fromValue: string, toValue: string): string | null {
  const fromDate = new Date(fromValue)
  const toDate = new Date(toValue)

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return 'Invalid from_time or to_time format'
  }

  if (toDate.getTime() <= fromDate.getTime()) {
    return 'to_time must be later than from_time'
  }

  if (toDate.getTime() - fromDate.getTime() > MAX_BOOKING_DURATION_MS) {
    return 'Booking duration cannot exceed 24 hours'
  }

  return null
}

export async function reconcileRecentBookings() {
  const [deletedResult] = await pool.execute(
    `DELETE FROM bookings
     WHERE from_time >= to_time`,
  )

  const [finishedResult] = await pool.execute(
    `UPDATE bookings
     SET status = 'finished'
     WHERE status = 'active'
       AND to_time < NOW()
       AND from_time < to_time`,
  )

  return {
    deletedInvalidBookings: (deletedResult as { affectedRows?: number }).affectedRows ?? 0,
    finishedBookings: (finishedResult as { affectedRows?: number }).affectedRows ?? 0,
  }
}

// Get all bookings
router.get('/', async (_req: Request, res: Response) => {
  const [rows] = await pool.execute(`
    SELECT b.id, b.testwall_id, b.user_id, b.from_time, b.to_time, b.status,
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
    `SELECT b.id, b.testwall_id, b.user_id, b.from_time, b.to_time, b.status, a.username
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
    `SELECT b.id, b.testwall_id, b.user_id, b.from_time, b.to_time, b.status, t.name as testwall_name, a.email as user_email
     FROM bookings b
     LEFT JOIN testwalls t ON b.testwall_id = t.id
     LEFT JOIN accounts a ON b.user_id = a.id
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

  const fromMysql = toMysqlDatetime(from_time as string)
  const toMysql = toMysqlDatetime(to_time as string)

  const [rows] = await pool.execute(
    `SELECT COUNT(*) as count FROM bookings 
     WHERE testwall_id = ? 
     AND from_time < ? 
     AND to_time > ?`,
    [testwall_id, toMysql, fromMysql],
  )

  const isAvailable = (rows as any[])[0].count === 0
  res.json({ available: isAvailable })
})

// Create booking
router.post('/', async (req: Request, res: Response) => {
  const { testwall_id, user_id, from_time, to_time, status } = req.body
  if (!testwall_id || !user_id || !from_time || !to_time) {
    res.status(400).json({ error: 'testwall_id, user_id, from_time, and to_time are required' })
    return
  }

  const bookingWindowError = validateBookingWindow(String(from_time), String(to_time))
  if (bookingWindowError) {
    res.status(400).json({ error: bookingWindowError })
    return
  }

  const normalizedStatus = typeof status === 'string' && status.trim() ? status.trim() : 'active'
  const fromMysql = toMysqlDatetime(from_time as string)
  const toMysql = toMysqlDatetime(to_time as string)

  // Check availability
  const [conflicts] = await pool.execute(
    `SELECT COUNT(*) as count FROM bookings 
     WHERE testwall_id = ? 
     AND from_time < ? 
     AND to_time > ?`,
    [testwall_id, toMysql, fromMysql],
  )

  if ((conflicts as any[])[0].count > 0) {
    res.status(409).json({ error: 'Testwall is not available for the requested time range' })
    return
  }

  await pool.execute(
    'INSERT INTO bookings (testwall_id, user_id, from_time, to_time, status) VALUES (?, ?, ?, ?, ?)',
    [testwall_id, user_id, fromMysql, toMysql, normalizedStatus],
  )
  const [result] = await pool.execute('SELECT LAST_INSERT_ID() as id')
  const bookingId = Number((result as any[])[0]?.id)

  if (bookingId > 0 && isBookingEmailEnabled()) {
    const [bookingContextRows] = await pool.execute(
      `SELECT a.email AS user_email, a.username, t.name AS testwall_name
       FROM accounts a
       LEFT JOIN testwalls t ON t.id = ?
       WHERE a.id = ?
       LIMIT 1`,
      [testwall_id, user_id],
    )

    const bookingContext = (bookingContextRows as any[])[0]
    const userEmail = String(bookingContext?.user_email ?? '').trim()

    if (userEmail) {
      try {
        await sendBookingCreatedEmail({
          to: userEmail,
          username: bookingContext?.username ? String(bookingContext.username) : null,
          testwallName: bookingContext?.testwall_name
            ? String(bookingContext.testwall_name)
            : `Testwall ${testwall_id}`,
          fromTime: fromMysql,
          toTime: toMysql,
          bookingId,
        })
      } catch (error) {
        console.error('Failed to send booking confirmation email:', error)
      }
    }
  }

  res.status(201).json({ id: bookingId, status: normalizedStatus })
})

// Update booking
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const { from_time, to_time, status } = req.body

  const updates: string[] = []
  const values: (string | number | Buffer | null)[] = []

  if (from_time !== undefined) {
    updates.push('from_time = ?')
    values.push(toMysqlDatetime(from_time as string))
  }

  if (to_time !== undefined) {
    updates.push('to_time = ?')
    values.push(toMysqlDatetime(to_time as string))
  }

  if (status !== undefined) {
    updates.push('status = ?')
    values.push(status)
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No booking fields provided for update' })
    return
  }

  if (from_time !== undefined || to_time !== undefined) {
    const [existingRows] = await pool.execute(
      'SELECT from_time, to_time FROM bookings WHERE id = ? LIMIT 1',
      [id],
    )

    if ((existingRows as any[]).length === 0) {
      res.status(404).json({ error: 'Booking not found' })
      return
    }

    const existingBooking = (existingRows as any[])[0]
    const nextFrom =
      from_time !== undefined ? String(from_time) : String(existingBooking.from_time ?? '')
    const nextTo = to_time !== undefined ? String(to_time) : String(existingBooking.to_time ?? '')

    const bookingWindowError = validateBookingWindow(nextFrom, nextTo)
    if (bookingWindowError) {
      res.status(400).json({ error: bookingWindowError })
      return
    }
  }

  values.push(id as string)
  await pool.execute(`UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`, values)
  res.json({ success: true })
})

router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  await pool.execute('DELETE FROM bookings WHERE id = ?', [id])
  res.json({ success: true })
})

export default router
