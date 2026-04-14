import { HttpException } from './HttpException.js'

/**
 * HTTP 413 Payload Too Large.
 */
export class PayloadTooLargeHttpException extends HttpException {
  public constructor(message = 'Payload Too Large', headers?: Record<string, string>) {
    super(413, message, headers, 'PAYLOAD_TOO_LARGE')
  }
}
