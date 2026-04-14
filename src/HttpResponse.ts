import type { Response } from 'express'

import { serializeJsonBody } from './jsonResponseSerializer.js'

/**
 * Fluent HTTP response wrapper around Express `Response`.
 */
export class HttpResponse {
  private statusCode = 200

  /**
   * @param res - Express response for the current request.
   */
  public constructor(private readonly res: Response) {}

  /**
   * Set the HTTP status code before sending.
   *
   * @param code - HTTP status.
   * @returns This instance (fluent).
   */
  public status(code: number): this {
    this.statusCode = code
    return this
  }

  /**
   * Send JSON, running the payload through the configured serializer (see {@link configureResponseSerializer}).
   *
   * @param body - Arbitrary data (models, arrays, plain objects).
   */
  public json(body: unknown): void {
    this.res
      .status(this.statusCode)
      .json(serializeJsonBody(body) as Parameters<Response['json']>[0])
  }

  /**
   * Send an empty or raw body with the current status.
   *
   * @param body - Optional body for `res.send`.
   */
  public send(body?: string | Buffer | object): void {
    this.res.status(this.statusCode).send(body as Parameters<Response['send']>[0])
  }
}
