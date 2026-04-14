import { ServiceUnavailableHttpException } from './ServiceUnavailableHttpException.js'

/**
 * HTTP 503 while the application is in maintenance mode.
 */
export class MaintenanceModeException extends ServiceUnavailableHttpException {
  public readonly wentDownAt: Date | undefined

  public constructor(
    retryAfter?: number | Date,
    wentDownAt?: Date,
    message = 'Application is in maintenance mode',
  ) {
    super(retryAfter, message)
    this.wentDownAt = wentDownAt
  }
}
