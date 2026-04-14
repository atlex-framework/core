import { HttpException } from './HttpException.js'

/**
 * HTTP 401 Unauthorized.
 */
export class UnauthorizedHttpException extends HttpException {
  public constructor(challenge?: string, message = 'Unauthorized') {
    const headers: Record<string, string> = challenge ? { 'WWW-Authenticate': challenge } : {}
    super(401, message, headers, 'UNAUTHORIZED')
  }
}
