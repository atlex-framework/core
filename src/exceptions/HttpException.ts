import type { Request, Response } from 'express'

import type { ExceptionHandler } from './Handler.js'
import type { HttpExceptionInterface } from './HttpExceptionInterface.js'

const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  413: 'Payload Too Large',
  419: 'Token Mismatch',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
}

const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  408: 'REQUEST_TIMEOUT',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  419: 'TOKEN_MISMATCH',
  422: 'VALIDATION_ERROR',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  503: 'SERVICE_UNAVAILABLE',
}

/**
 * Base HTTP exception with status, optional headers, and optional custom render/report hooks.
 */
export class HttpException extends Error implements HttpExceptionInterface {
  public readonly statusCode: number

  public readonly headers: Record<string, string>

  public readonly code: string

  public constructor(
    statusCode: number,
    message?: string,
    headers?: Record<string, string>,
    code?: string,
  ) {
    super(message ?? HttpException.defaultMessageForStatus(statusCode))
    this.statusCode = statusCode
    this.headers = headers ?? {}
    this.code = code ?? HttpException.defaultCodeForStatus(statusCode)
    this.name = this.constructor.name
  }

  /**
   * Override in subclass to produce a custom HTTP response.
   * If this returns void/undefined, the default rendering is used.
   */
  public render?(req: Request, res: Response): Response | void | Promise<Response | void>

  /**
   * Override in subclass to do custom reporting (e.g. alert Sentry, Slack).
   * If this method exists, the default report() logic is skipped.
   */
  public report?(handler?: ExceptionHandler): void | Promise<void>

  /**
   * Add extra context that will be merged into the log entry.
   */
  public context?(): Record<string, unknown>

  /** Default message for a status code (e.g. 404 → 'Not Found'). */
  public static defaultMessageForStatus(status: number): string {
    return DEFAULT_MESSAGES[status] ?? `HTTP Error ${String(status)}`
  }

  /** Default machine code for a status code (e.g. 404 → 'NOT_FOUND'). */
  public static defaultCodeForStatus(status: number): string {
    return DEFAULT_CODES[status] ?? `HTTP_${String(status)}`
  }
}
