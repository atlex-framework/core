import { HttpException } from './HttpException.js'

/**
 * HTTP 419 Token Mismatch (CSRF).
 */
export class TokenMismatchHttpException extends HttpException {
  public constructor(message = 'Token Mismatch') {
    super(419, message, {}, 'TOKEN_MISMATCH')
  }
}
