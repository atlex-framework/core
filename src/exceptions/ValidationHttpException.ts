import type { Request, Response } from 'express'

import { HttpException } from './HttpException.js'

/**
 * HTTP 422 validation error with a field error bag.
 */
export class ValidationHttpException extends HttpException {
  public readonly errors: Record<string, string[]>

  public constructor(errors: Record<string, string[]>, message = 'Validation failed') {
    super(422, message, {}, 'VALIDATION_ERROR')
    this.errors = errors
  }

  public override render(_req: Request, res: Response): Response {
    return res.status(422).json({
      error: {
        status: 422,
        message: this.message,
        code: 'VALIDATION_ERROR',
        errors: this.errors,
      },
    })
  }
}
