import { HttpException } from './HttpException.js'

/**
 * HTTP 409 Conflict.
 */
export class ConflictHttpException extends HttpException {
  public constructor(message = 'Conflict', headers?: Record<string, string>) {
    super(409, message, headers, 'CONFLICT')
  }
}
