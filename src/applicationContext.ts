import type { Application } from './Application.js'

let current: Application | null = null

/**
 * Called from {@link Application.boot} so route handlers can resolve the active app (e.g. `[Controller, "method"]` routes).
 *
 * @param app - Application being booted.
 */
export function setApplicationContext(app: Application): void {
  current = app
}

/**
 * @returns The application set during {@link Application.boot}.
 * @throws Error when called before boot.
 */
export function getApplicationContext(): Application {
  if (current === null) {
    throw new Error(
      'Application context not set. Call application.boot() before handling HTTP requests.',
    )
  }
  return current
}

/**
 * Clears context (for tests).
 */
export function resetApplicationContextForTests(): void {
  current = null
}
