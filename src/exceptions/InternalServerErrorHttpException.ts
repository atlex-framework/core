import { HttpException } from './HttpException.js'

/**
 * HTTP 500 Internal Server Error.
 */
export class InternalServerErrorHttpException extends HttpException {
  public constructor(message = 'Internal Server Error') {
    super(500, message, {}, 'INTERNAL_SERVER_ERROR')
  }
}
