import { HttpException } from './HttpException.js'

/**
 * HTTP 503 Service Unavailable.
 */
export class ServiceUnavailableHttpException extends HttpException {
  public constructor(retryAfter?: number | Date, message = 'Service Unavailable') {
    const headers: Record<string, string> = {}
    if (retryAfter instanceof Date) {
      headers['Retry-After'] = retryAfter.toUTCString()
    } else if (typeof retryAfter === 'number') {
      headers['Retry-After'] = String(retryAfter)
    }
    super(503, message, headers, 'SERVICE_UNAVAILABLE')
  }
}
