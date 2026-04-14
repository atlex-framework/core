import { HttpException } from './HttpException.js'

/**
 * HTTP 403 Forbidden.
 */
export class ForbiddenHttpException extends HttpException {
  public constructor(message = 'Forbidden', headers?: Record<string, string>) {
    super(403, message, headers, 'FORBIDDEN')
  }
}
