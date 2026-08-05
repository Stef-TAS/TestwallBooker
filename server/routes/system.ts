import { Router } from 'express'
import { pool } from '../db'
import type { Request, Response } from 'express'

const router = Router()

async function checkDatabase() {
  try {
    await pool.execute('SELECT 1')
    return { running: true as const }
  } catch (error) {
    return {
      running: false as const,
      error: error instanceof Error ? error.message : 'Database check failed',
    }
  }
}

async function checkPythonServer() {
  const pythonStatusUrl = process.env.PYTHON_STATUS_URL ?? 'http://127.0.0.1:8080/api/machines'

  try {
    const response = await fetch(pythonStatusUrl, {
      signal: AbortSignal.timeout(3000),
    })

    if (!response.ok) {
      return {
        running: false as const,
        error: `HTTP ${response.status}`,
      }
    }

    return { running: true as const }
  } catch (error) {
    return {
      running: false as const,
      error: error instanceof Error ? error.message : 'Python status check failed',
    }
  }
}

router.get('/status', async (_req: Request, res: Response) => {
  const [database, python] = await Promise.all([checkDatabase(), checkPythonServer()])

  res.json({
    database,
    python,
    checkedAt: new Date().toISOString(),
  })
})

export default router
