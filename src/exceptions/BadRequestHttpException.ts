import { HttpException } from './HttpException.js'

/**
 * HTTP 400 Bad Request.
 */
export class BadRequestHttpException extends HttpException {
  public constructor(message = 'Bad Request', headers?: Record<string, string>) {
    super(400, message, headers, 'BAD_REQUEST')
  }
}
