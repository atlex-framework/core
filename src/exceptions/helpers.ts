import { BadRequestHttpException } from './BadRequestHttpException.js'
import { ConflictHttpException } from './ConflictHttpException.js'
import { ForbiddenHttpException } from './ForbiddenHttpException.js'
import { HttpException } from './HttpException.js'
import { InternalServerErrorHttpException } from './InternalServerErrorHttpException.js'
import { MethodNotAllowedHttpException } from './MethodNotAllowedHttpException.js'
import { NotFoundHttpException } from './NotFoundHttpException.js'
import { PayloadTooLargeHttpException } from './PayloadTooLargeHttpException.js'
import { RequestTimeoutHttpException } from './RequestTimeoutHttpException.js'
import { TokenMismatchHttpException } from './TokenMismatchHttpException.js'
import { TooManyRequestsHttpException } from './TooManyRequestsHttpException.js'
import { UnauthorizedHttpException } from './UnauthorizedHttpException.js'

/**
 * Throw an HTTP exception for the given status (or rethrow an existing {@link HttpException}).
 */
export function abort(
  status: number | HttpException,
  message?: string,
  headers?: Record<string, string>,
): never {
  if (status instanceof HttpException) {
    throw status
  }
  switch (status) {
    case 400:
      throw new BadRequestHttpException(message, headers)
    case 401:
      throw new UnauthorizedHttpException(undefined, message ?? 'Unauthorized')
    case 403:
      throw new ForbiddenHttpException(message ?? 'Forbidden', headers)
    case 404:
      throw new NotFoundHttpException(message, headers)
    case 405:
      throw new MethodNotAllowedHttpException([], message ?? 'Method Not Allowed')
    case 408:
      throw new RequestTimeoutHttpException(message)
    case 409:
      throw new ConflictHttpException(message, headers)
    case 413:
      throw new PayloadTooLargeHttpException(message, headers)
    case 419:
      throw new TokenMismatchHttpException(message)
    case 429:
      throw new TooManyRequestsHttpException(undefined, message)
    case 500:
      throw new InternalServerErrorHttpException(message)
    default:
      throw new HttpException(status, message, headers)
  }
}

/**
 * Throw if `condition` is true.
 */
export function abort_if(
  condition: boolean,
  status: number | HttpException,
  message?: string,
  headers?: Record<string, string>,
): asserts condition is false {
  if (condition) {
    abort(status, message, headers)
  }
}

/**
 * Throw unless `condition` is true.
 */
export function abort_unless(
  condition: boolean,
  status: number | HttpException,
  message?: string,
  headers?: Record<string, string>,
): asserts condition is true {
  if (!condition) {
    abort(status, message, headers)
  }
}
