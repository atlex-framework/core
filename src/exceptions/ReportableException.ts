import type { ExceptionHandler } from './Handler.js'

/**
 * If an exception implements this, {@link ExceptionHandler} calls `report()` instead of default logging.
 */
export interface ReportableException {
  report(handler?: ExceptionHandler): void | Promise<void>
}
