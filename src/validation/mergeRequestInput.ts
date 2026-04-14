import type { Request } from 'express'

/**
 * Merge Express `params`, `query`, and `body` into one object for validation (later keys win: body overrides query and params).
 */
export function mergeRequestInput(req: Request): Record<string, unknown> {
  const params =
    typeof req.params === 'object' && req.params !== null
      ? ({ ...req.params } as Record<string, unknown>)
      : {}
  const query =
    typeof req.query === 'object' && req.query !== null
      ? ({ ...req.query } as Record<string, unknown>)
      : {}
  const body =
    typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body)
      ? ({ ...req.body } as Record<string, unknown>)
      : {}

  return { ...params, ...query, ...body }
}
