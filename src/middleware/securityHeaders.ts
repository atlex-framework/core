import helmet, { type HelmetOptions } from 'helmet'

import type { RequestHandler } from '../Router.js'

/**
 * Create security headers middleware wrapper around the `helmet` package.
 */
export function securityHeaders(options?: HelmetOptions): RequestHandler {
  return helmet(options)
}
