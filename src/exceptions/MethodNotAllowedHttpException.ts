import { HttpException } from './HttpException.js'

/**
 * HTTP 405 Method Not Allowed.
 */
export class MethodNotAllowedHttpException extends HttpException {
  public constructor(allowed: string[], message = 'Method Not Allowed') {
    super(405, message, { Allow: allowed.join(', ') }, 'METHOD_NOT_ALLOWED')
  }
}
