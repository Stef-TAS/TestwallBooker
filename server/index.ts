import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT ?? '10mb'
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

if (IS_PRODUCTION) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const distPath = path.resolve(__dirname, '../dist')
  app.use(express.static(distPath))
} else {
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }))
}
app.use(express.json({ limit: JSON_BODY_LIMIT }))

app.use('/api/logs', logsRouter)
app.use('/api/history', historyRouter)
app.use('/api/auth', authRouter)
app.use('/api/accounts', accountsRouter)
app.use('/api/testwalls', testwallsRouter)
app.use('/api/bookings', bookingsRouter)
app.use('/api/access-rights', accessRightsRouter)

if (IS_PRODUCTION) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const distPath = path.resolve(__dirname, '../dist')
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Uploaded image is too large. Please choose a smaller file.' })
    return
  }

  next(err)
})

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
