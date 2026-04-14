import { AsyncLocalStorage } from 'node:async_hooks'

import type { Request, Response } from 'express'

/**
 * Per-request store for `response()` and `request()` helpers.
 */
export interface HttpContextStore {
  /** Current Express request. */
  req: Request
  /** Current Express response. */
  res: Response
}

const storage = new AsyncLocalStorage<HttpContextStore>()

/**
 * Run a callback with HTTP context active (used by {@link Application.boot} middleware).
 *
 * @param store - Request and response for this request.
 * @param fn - Synchronous entry; async work inside must be scheduled from this turn to keep ALS.
 * @returns The callback return value.
 */
export function runWithHttpContext<T>(store: HttpContextStore, fn: () => T): T {
  return storage.run(store, fn)
}

/**
 * Current request/response pair, or `undefined` outside the HTTP middleware stack.
 */
export function tryGetHttpContext(): HttpContextStore | undefined {
  return storage.getStore()
}

/**
 * @throws Error when called outside an active HTTP context (e.g. before {@link Application.boot} or without passing `res` to {@link response}).
 */
export function getHttpContext(): HttpContextStore {
  const ctx = storage.getStore()
  if (ctx === undefined) {
    throw new Error(
      'No HTTP context: use response(res) with an explicit Express response, or register middleware via Application.boot() before calling response() with no arguments.',
    )
  }
  return ctx
}
