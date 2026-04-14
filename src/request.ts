import type { Request } from 'express'

import { getHttpContext } from './httpContext.js'
import { mergeRequestInput } from './validation/mergeRequestInput.js'
import type { RuleMap } from './validation/validate.js'
import type { ValidationMessages } from './validation/ValidationMessages.js'
import { Validator } from './validation/Validator.js'

const requestValidateProxyCache = new WeakMap<Request, Request>()

/**
 * Returns the current Express request (requires an active HTTP context from {@link Application.boot}).
 *
 * The returned `Request` includes {@link Express.Request.validate} for merged route, query, and body validation.
 *
 * @returns The active `req` for this request.
 * @throws Error outside request handling — use the `req` argument or pass context explicitly.
 */
export function request(): Request {
  const req = getHttpContext().req
  const cached = requestValidateProxyCache.get(req)
  if (cached !== undefined) {
    return cached
  }
  const proxy = new Proxy(req, {
    get(target, prop) {
      if (prop === 'validate') {
        return (rules: RuleMap, messages?: ValidationMessages): Record<string, unknown> =>
          Validator.validate(mergeRequestInput(target), rules, messages ?? {})
      }
      // Avoid passing the Proxy as `receiver` — Express `Request` getters rely on the real `req` as `this`.
      const value = Reflect.get(target, prop)
      if (typeof value === 'function') {
        return (value as (...args: unknown[]) => unknown).bind(target)
      }
      return value
    },
  })
  requestValidateProxyCache.set(req, proxy)
  return proxy
}

declare global {
  namespace Express {
    interface Request {
      /**
       * Validate merged `params`, `query`, and `body` against `rules` and optional custom `messages`.
       */
      validate(rules: RuleMap, messages?: ValidationMessages): Record<string, unknown>
    }
  }
}
