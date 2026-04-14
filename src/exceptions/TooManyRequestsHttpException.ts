import { HttpException } from './HttpException.js'

/**
 * HTTP 429 Too Many Requests.
 */
export class TooManyRequestsHttpException extends HttpException {
  public readonly retryAfterSeconds: number | undefined

  public constructor(retryAfter?: number, message = 'Too Many Requests') {
    const headers: Record<string, string> = retryAfter ? { 'Retry-After': String(retryAfter) } : {}
    super(429, message, headers, 'TOO_MANY_REQUESTS')
    this.retryAfterSeconds = retryAfter
  }
}
