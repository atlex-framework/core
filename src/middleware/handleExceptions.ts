import type { ErrorRequestHandler } from 'express'

import { type ExceptionHandler } from '../exceptions/Handler.js'

/**
 * Express error-handling middleware: reports then renders via the resolved {@link ExceptionHandler}.
 * Register after routes with `app.use(handleExceptions(() => app.make('exception.handler')))`.
 */
export function handleExceptions(resolveHandler: () => ExceptionHandler): ErrorRequestHandler {
  return async (err, req, res, next) => {
    if (res.headersSent) {
      next(err)
      return
    }
    const wrapped = err instanceof Error ? err : new Error(String(err))
    const handler = resolveHandler()
    try {
      await handler.report(wrapped, req)
    } catch (reportFailure) {
      process.stderr.write(
        `[EMERGENCY] Failed to report exception: ${String(reportFailure)}\n${wrapped.stack ?? ''}\n`,
      )
    }
    try {
      await handler.render(wrapped, req, res)
    } catch {
      if (!res.headersSent) {
        res.status(500).json({
          error: { status: 500, message: 'Internal Server Error' },
        })
      }
    } finally {
      handler.clearReportDedup()
    }
  }
}
