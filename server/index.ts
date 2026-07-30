import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { initDb } from './db'
import logsRouter from './routes/logs'
import historyRouter from './routes/history'
import accountsRouter from './routes/accounts'
import testwallsRouter from './routes/testwalls'
import bookingsRouter, { reconcileRecentBookings } from './routes/bookings'
import accessRightsRouter from './routes/access-rights'
import authRouter from './routes/auth'

const app = express()
const PORT = Number(process.env.SERVER_PORT ?? 3001)

app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/logs', logsRouter)
app.use('/api/history', historyRouter)
app.use('/api/auth', authRouter)
app.use('/api/accounts', accountsRouter)
app.use('/api/testwalls', testwallsRouter)
app.use('/api/bookings', bookingsRouter)
app.use('/api/access-rights', accessRightsRouter)

initDb()
  .then(async () => {
    const bookingCleanup = await reconcileRecentBookings()
    console.log('Booking startup cleanup complete:', bookingCleanup)

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err)
    process.exit(1)
  })
