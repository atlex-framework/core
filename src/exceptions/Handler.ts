import type { Request, Response } from 'express'

import { ValidationException } from '../validation/ValidationException.js'

import { hasContext } from './exceptionTypeGuards.js'
import { HttpException } from './HttpException.js'

type ErrorConstructor = new (...args: never[]) => Error

/**
 * Minimal application surface used by {@link ExceptionHandler} to resolve `config` and `log`
 * without importing optional packages (avoids circular dependencies).
 */
export interface ExceptionHandlerApp {
  make<TValue>(abstractKey: string): TValue
}

interface LogService {
  error(message: string, context?: Record<string, unknown>): void | Promise<void>
}

interface ConfigService {
  get(key: string): unknown
}

function getOwnFunction(
  error: Error,
  key: 'render' | 'report',
): ((...args: unknown[]) => unknown) | undefined {
  const proto = Object.getPrototypeOf(error) as object | null
  const fromProto = proto !== null ? Object.getOwnPropertyDescriptor(proto, key) : undefined
  const fromSelf = Object.getOwnPropertyDescriptor(error, key)
  const desc = fromSelf?.value !== undefined ? fromSelf : fromProto
  if (desc === undefined || typeof desc.value !== 'function') {
    return undefined
  }
  return desc.value as (...args: unknown[]) => unknown
}

function walkErrorConstructors(error: Error): ErrorConstructor[] {
  const list: ErrorConstructor[] = []
  let current: unknown = error.constructor
  while (typeof current === 'function') {
    const ctor = current as ErrorConstructor
    list.push(ctor)
    if (ctor === Error) {
      break
    }
    const next = Object.getPrototypeOf(current)
    if (next === null) {
      break
    }
    current = next
  }
  return list
}

function stripSensitiveKeys(value: unknown, blocked: ReadonlySet<string>): unknown {
  if (value === null || typeof value !== 'object') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripSensitiveKeys(item, blocked))
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (blocked.has(k)) {
      continue
    }
    out[k] = stripSensitiveKeys(v, blocked)
  }
  return out
}

function wantsJson(req: Request): boolean {
  const accept = req.headers.accept
  if (typeof accept !== 'string') {
    return true
  }
  return accept.includes('application/json') || accept.includes('*/*')
}

/**
 * Centralized HTTP exception reporting and rendering.
 */
export class ExceptionHandler {
  /**
   * Exception classes that should NOT be reported to logs.
   */
  protected dontReport: ErrorConstructor[] = [ValidationException]

  /**
   * Request input keys that must never appear in error context/logs.
   */
  protected dontFlash: string[] = [
    'password',
    'password_confirmation',
    'current_password',
    'token',
    'secret',
    'credit_card',
    'cvv',
  ]

  private readonly reportableCallbacks = new Map<
    ErrorConstructor,
    ((error: Error) => void | Promise<void>)[]
  >()

  private readonly renderableCallbacks = new Map<
    ErrorConstructor,
    (error: Error, req: Request, res: Response) => Response | void | Promise<Response | void>
  >()

  private readonly reportedErrors = new Set<string>()

  private deduplicateReports = false

  private readonly ignoredExceptions = new Set<ErrorConstructor>()

  public constructor(protected readonly app: ExceptionHandlerApp) {}

  /**
   * Optional setup hook for subclasses (custom reporters, renderers, dedup).
   */
  public async register(): Promise<void> {
    await Promise.resolve()
  }

  /**
   * Register a custom reporter for a specific exception class.
   */
  public reportable<T extends Error>(
    exceptionClass: new (...args: never[]) => T,
    callback: (error: T) => void | Promise<void>,
  ): this {
    const existing = this.reportableCallbacks.get(exceptionClass) ?? []
    existing.push(callback as (error: Error) => void | Promise<void>)
    this.reportableCallbacks.set(exceptionClass, existing)
    return this
  }

  /**
   * Register a custom renderer for a specific exception class (last registration wins).
   */
  public renderable<T extends Error>(
    exceptionClass: new (...args: never[]) => T,
    callback: (error: T, req: Request, res: Response) => Response | void | Promise<Response | void>,
  ): this {
    this.renderableCallbacks.set(
      exceptionClass,
      callback as (
        error: Error,
        req: Request,
        res: Response,
      ) => Response | void | Promise<Response | void>,
    )
    return this
  }

  /**
   * Prevent duplicate reporting of the same exception within a request lifecycle.
   */
  public withoutDuplicates(): this {
    this.deduplicateReports = true
    return this
  }

  /**
   * Ignore an exception class for reporting (and treat as non-reportable).
   */
  public ignore(exceptionClass: ErrorConstructor): this {
    this.ignoredExceptions.add(exceptionClass)
    return this
  }

  /**
   * Clears deduplication state after a request (call from global error middleware).
   */
  public clearReportDedup(): void {
    this.reportedErrors.clear()
  }

  /**
   * Report an exception to the logging system (never throws).
   */
  public async report(error: Error, req?: Request): Promise<void> {
    try {
      if (this.isIgnored(error)) {
        return
      }
      if (!this.shouldReport(error)) {
        return
      }
      if (this.deduplicateReports) {
        const hash = this.getErrorHash(error)
        if (this.reportedErrors.has(hash)) {
          return
        }
        this.reportedErrors.add(hash)
      }

      const reportFn = getOwnFunction(error, 'report')
      if (reportFn !== undefined) {
        await Promise.resolve(reportFn.call(error, this))
        return
      }

      for (const ctor of walkErrorConstructors(error)) {
        const callbacks = this.reportableCallbacks.get(ctor)
        if (callbacks === undefined) {
          continue
        }
        for (const cb of callbacks) {
          await Promise.resolve(cb(error))
        }
      }

      await this.defaultLog(error, req)
    } catch (reportFailure) {
      const extra =
        reportFailure instanceof Error
          ? (reportFailure.stack ?? reportFailure.message)
          : String(reportFailure)
      process.stderr.write(`[EMERGENCY] ExceptionHandler.report failed: ${extra}\n`)
      process.stderr.write(`[EMERGENCY] Original: ${error.message}\n${error.stack ?? ''}\n`)
    }
  }

  /**
   * Render an exception into an HTTP response (never throws).
   */
  public async render(error: Error, req: Request, res: Response): Promise<Response | void> {
    try {
      if (res.headersSent) {
        return undefined
      }

      const renderFn = getOwnFunction(error, 'render')
      if (renderFn !== undefined) {
        await Promise.resolve(renderFn.call(error, req, res))
        if (res.headersSent) {
          return res
        }
      }

      for (const ctor of walkErrorConstructors(error)) {
        const cb = this.renderableCallbacks.get(ctor)
        if (cb !== undefined) {
          await Promise.resolve(cb(error, req, res))
          if (res.headersSent) {
            return res
          }
        }
      }

      if (error instanceof ValidationException) {
        return this.sendValidationException(error, res)
      }

      if (error.name === 'AuthenticationError') {
        return this.sendStandardJson(req, res, 401, error.message, 'UNAUTHORIZED')
      }
      if (error.name === 'AuthorizationError') {
        return this.sendStandardJson(req, res, 403, error.message, 'FORBIDDEN')
      }

      if (error instanceof HttpException) {
        return this.sendHttpException(error, req, res)
      }

      if (this.isDebug()) {
        return this.sendDebugError(error, req, res)
      }

      return this.sendStandardJson(req, res, 500, 'Internal Server Error', 'INTERNAL_SERVER_ERROR')
    } catch {
      if (!res.headersSent) {
        res.status(500).json({
          error: { status: 500, message: 'Internal Server Error' },
        })
      }
      return res
    }
  }

  /**
   * Render an exception for CLI / console output.
   */
  public renderForConsole(error: Error): void {
    const lines: string[] = [`${error.name}: ${error.message}`]
    if (this.isDebug() && error.stack !== undefined) {
      lines.push(error.stack)
    }
    if (hasContext(error)) {
      try {
        lines.push(`Context: ${JSON.stringify(error.context(), null, 2)}`)
      } catch {
        lines.push('Context: [unserializable]')
      }
    }
    process.stderr.write(`${lines.join('\n')}\n`)
  }

  protected shouldReport(error: Error): boolean {
    if (this.matchesDontReport(error)) {
      return false
    }
    if (error instanceof HttpException && error.statusCode < 500) {
      return false
    }
    if (error.name === 'AuthenticationError' || error.name === 'AuthorizationError') {
      return false
    }
    return true
  }

  protected buildContext(error: Error, req?: Request): Record<string, unknown> {
    const blocked = new Set(this.dontFlash.map((k) => k.toLowerCase()))
    const ctx: Record<string, unknown> = {}

    if (req !== undefined) {
      ctx.url = `${req.method} ${req.url}`
      ctx.method = req.method
      ctx.ip = req.ip
      if (typeof req.headers['x-request-id'] === 'string') {
        ctx.requestId = req.headers['x-request-id']
      }
      const body =
        typeof req.body === 'object' && req.body !== null
          ? stripSensitiveKeys(req.body as Record<string, unknown>, blocked)
          : undefined
      if (body !== undefined) {
        ctx.input = body
      }
    }

    if (hasContext(error)) {
      try {
        Object.assign(ctx, stripSensitiveKeys(error.context(), blocked))
      } catch {
        /* skip malformed context */
      }
    }

    return ctx
  }

  private getErrorHash(error: Error): string {
    const stackHead = (error.stack ?? '').split('\n').slice(0, 3).join('\n')
    return `${error.message}\n${stackHead}`
  }

  private isIgnored(error: Error): boolean {
    for (const ctor of this.ignoredExceptions) {
      if (error instanceof ctor) {
        return true
      }
    }
    return false
  }

  private matchesDontReport(error: Error): boolean {
    for (const ctor of this.dontReport) {
      if (error instanceof ctor) {
        return true
      }
    }
    return false
  }

  private isDebug(): boolean {
    try {
      const cfg = this.app.make<ConfigService>('config')
      const debug = cfg.get('app.debug')
      if (typeof debug === 'boolean') {
        return debug
      }
    } catch {
      /* config not bound */
    }
    return process.env.NODE_ENV !== 'production'
  }

  private async defaultLog(error: Error, req?: Request): Promise<void> {
    const context = this.buildContext(error, req)
    context.exception = error.name
    if (error.stack !== undefined) {
      context.stack = error.stack
    }
    try {
      const log = this.app.make<LogService>('log')
      await Promise.resolve(log.error(error.message, context))
    } catch {
      process.stderr.write(`[EMERGENCY] Log failed for: ${error.message}\n${error.stack ?? ''}\n`)
    }
  }

  private sendValidationException(error: ValidationException, res: Response): Response {
    return res.status(422).json({
      error: {
        status: 422,
        message: error.message,
        code: 'VALIDATION_ERROR',
        errors: error.errors,
      },
    })
  }

  private sendStandardJson(
    req: Request,
    res: Response,
    status: number,
    message: string,
    code: string,
  ): Response {
    if (!wantsJson(req)) {
      res
        .status(status)
        .type('json')
        .send(
          JSON.stringify({
            error: { status, message, code },
          }),
        )
      return res
    }
    return res.status(status).json({
      error: { status, message, code },
    })
  }

  private sendHttpException(error: HttpException, req: Request, res: Response): Response {
    for (const [key, value] of Object.entries(error.headers)) {
      res.setHeader(key, value)
    }
    const body: Record<string, unknown> = {
      status: error.statusCode,
      message: error.message,
      code: error.code,
    }
    if (!wantsJson(req)) {
      res
        .status(error.statusCode)
        .type('json')
        .send(JSON.stringify({ error: body }))
      return res
    }
    return res.status(error.statusCode).json({ error: body })
  }

  private sendDebugError(error: Error, req: Request, res: Response): Response {
    const firstFrame = (error.stack ?? '').split('\n')[1]?.trim() ?? ''
    const trace = (error.stack ?? '').split('\n').map((l) => l.trim())
    const body: Record<string, unknown> = {
      status: 500,
      message: error.message,
      code: 'INTERNAL_SERVER_ERROR',
      exception: error.name,
      file: firstFrame,
      trace,
      context: this.buildContext(error, req),
    }
    if (!wantsJson(req)) {
      res
        .status(500)
        .type('json')
        .send(JSON.stringify({ error: body }))
      return res
    }
    return res.status(500).json({ error: body })
  }
}
