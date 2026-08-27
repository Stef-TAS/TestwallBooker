import { Router } from 'express'
import { pool } from '../db'
import type { Request, Response } from 'express'

const router = Router()

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    const details: string[] = [error.message]

    if (error.cause) {
      if (error.cause instanceof Error) {
        details.push(`Cause: ${error.cause.message}`)
        if (error.cause.stack) {
          details.push(`Cause stack:\n${error.cause.stack}`)
        }
      } else {
        details.push(`Cause: ${String(error.cause)}`)
      }
    }

    if (error.stack) {
      details.push(`Stack:\n${error.stack}`)
    }

    return details.join('\n\n')
  }

  return String(error)
}

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
      const bodyText = await response.text()
      return {
        running: false as const,
        error: [
          `HTTP ${response.status} ${response.statusText}`,
          `URL: ${pythonStatusUrl}`,
          bodyText ? `Response body:\n${bodyText}` : null,
        ]
          .filter((line) => line !== null)
          .join('\n\n'),
      }
    }

    return { running: true as const }
  } catch (error) {
    return {
      running: false as const,
      error: [`URL: ${pythonStatusUrl}`, formatUnknownError(error)].join('\n\n'),
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
