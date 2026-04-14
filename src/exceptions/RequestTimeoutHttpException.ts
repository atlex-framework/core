import { HttpException } from './HttpException.js'

/**
 * HTTP 408 Request Timeout.
 */
export class RequestTimeoutHttpException extends HttpException {
  public constructor(message = 'Request Timeout') {
    super(408, message, {}, 'REQUEST_TIMEOUT')
  }
}
