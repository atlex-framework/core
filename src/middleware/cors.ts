import cors, { type CorsOptions } from 'cors'

import type { RequestHandler } from '../Router.js'

/**
 * Create a CORS middleware wrapper around the `cors` package.
 */
export function corsMiddleware(options?: CorsOptions): RequestHandler {
  return cors(options)
}
