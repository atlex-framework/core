import type { Response } from 'express'

import { getHttpContext } from './httpContext.js'
import { HttpResponse } from './HttpResponse.js'

/**
 * Fluent HTTP response helper. Chain `.status().json()` against the current Express `Response`.
 *
 * With no arguments, uses the current request’s `res` (set by {@link Application.boot} HTTP context middleware).
 * Pass `res` explicitly in tests or code that runs outside that middleware.
 *
 * @param res - Optional Express `res` when not inside HTTP context.
 * @returns Fluent {@link HttpResponse}.
 * @example
 * ```ts
 * import { serializeForHttp } from "@atlex/orm";
 * import { configureResponseSerializer, response } from "@atlex/core";
 *
 * configureResponseSerializer(serializeForHttp);
 *
 * async index() {
 *   response().json(await User.all());
 * }
 * ```
 */
export function response(): HttpResponse
export function response(res: Response): HttpResponse
export function response(res?: Response): HttpResponse {
  const target = res ?? getHttpContext().res
  return new HttpResponse(target)
}
