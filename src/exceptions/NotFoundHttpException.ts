import { HttpException } from './HttpException.js'

/**
 * HTTP 404 Not Found.
 */
export class NotFoundHttpException extends HttpException {
  public constructor(message = 'Not Found', headers?: Record<string, string>) {
    super(404, message, headers, 'NOT_FOUND')
  }
}
