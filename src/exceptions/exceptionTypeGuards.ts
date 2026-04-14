import type { RenderableException } from './RenderableException.js'
import type { ReportableException } from './ReportableException.js'

/**
 * @param error - Value to narrow.
 * @returns Whether `error` exposes a `render` function.
 */
export function isRenderable(error: unknown): error is RenderableException {
  if (typeof error !== 'object' || error === null) {
    return false
  }
  const candidate = error as { render?: unknown }
  return typeof candidate.render === 'function'
}

/**
 * @param error - Value to narrow.
 * @returns Whether `error` exposes a `report` function.
 */
export function isReportable(error: unknown): error is ReportableException {
  if (typeof error !== 'object' || error === null) {
    return false
  }
  const candidate = error as { report?: unknown }
  return typeof candidate.report === 'function'
}

export interface ContextualException {
  context(): Record<string, unknown>
}

/**
 * @param error - Value to narrow.
 * @returns Whether `error` exposes a `context()` method for log enrichment.
 */
export function hasContext(error: unknown): error is ContextualException {
  if (typeof error !== 'object' || error === null) {
    return false
  }
  const candidate = error as { context?: unknown }
  return typeof candidate.context === 'function'
}
