import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, type ChildProcess } from 'node:child_process'
import { initDb } from './db'
import logsRouter from './routes/logs'
import historyRouter from './routes/history'
import accountsRouter from './routes/accounts'
import testwallsRouter from './routes/testwalls'
import bookingsRouter, { reconcileRecentBookings } from './routes/bookings'
import accessRightsRouter from './routes/access-rights'
import authRouter from './routes/auth'
import systemRouter from './routes/system'
import agentRouter from './routes/agent'

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
app.use('/api/system', systemRouter)
app.use('/api/agent', agentRouter)

if (IS_PRODUCTION) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const distPath = path.resolve(__dirname, '../dist')
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.use(
  (err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    const error = err as { type?: string } | undefined

    if (error?.type === 'entity.too.large') {
      res.status(413).json({ error: 'Uploaded image is too large. Please choose a smaller file.' })
      return
    }

    next(err)
  },
)

initDb()
  .then(async () => {
    const bookingCleanup = await reconcileRecentBookings()
    console.log('Booking startup cleanup complete:', bookingCleanup)

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
    })

    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const PYTHON_SCRIPT = path.resolve(__dirname, '../src/python/server.py')
    const pythonCmd = process.env.PYTHON_CMD ?? (process.platform === 'win32' ? 'py' : 'python3')
    let pythonProcess: ChildProcess | null = null
    let shuttingDown = false

    const startPythonProcess = () => {
      pythonProcess = spawn(pythonCmd, [PYTHON_SCRIPT], {
        stdio: 'inherit',
        cwd: path.dirname(PYTHON_SCRIPT),
      })

      console.log(
        `Python process started: ${pythonCmd} ${PYTHON_SCRIPT} (pid ${pythonProcess.pid})`,
      )

      pythonProcess.on('error', (err) => {
        console.error('Failed to start Python process:', err)
      })

      pythonProcess.on('exit', (code, signal) => {
        console.warn(`Python process exited (code=${code}, signal=${signal})`)

        if (shuttingDown) {
          return
        }

        setTimeout(() => {
          if (!shuttingDown) {
            console.warn('Restarting Python process...')
            startPythonProcess()
          }
        }, 5000)
      })
    }

    startPythonProcess()

    function shutdown() {
      shuttingDown = true
      if (pythonProcess && !pythonProcess.killed) {
        console.log('Stopping Python process...')
        pythonProcess.kill()
      }
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err)
    process.exit(1)
  })
