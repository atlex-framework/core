import type { Request, Response } from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ExceptionHandler } from '../../src/exceptions/Handler.js'
import { HttpException } from '../../src/exceptions/HttpException.js'
import { NotFoundHttpException } from '../../src/exceptions/NotFoundHttpException.js'
import { ValidationHttpException } from '../../src/exceptions/ValidationHttpException.js'
import { ValidationException } from '../../src/validation/ValidationException.js'

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    url: '/test',
    ip: '127.0.0.1',
    headers: { accept: 'application/json' },
    body: { password: 'secret', name: 'Ada' },
    ...overrides,
  } as Request
}

function mockRes(): Response & { _status: number; _body: unknown } {
  const res = {
    _status: 200,
    _body: undefined as unknown,
    headersSent: false,
    status(code: number) {
      this._status = code
      return this
    },
    json(body: unknown) {
      this._body = body
      this.headersSent = true
      return this
    },
    type() {
      return this
    },
    send(payload: string) {
      this._body = JSON.parse(payload) as unknown
      this.headersSent = true
      return this
    },
    setHeader(_k: string, _v: string) {
      return this
    },
  }
  return res as unknown as Response & { _status: number; _body: unknown }
}

function createApp(options: {
  debug?: boolean
  logImpl?: (message: string, context?: Record<string, unknown>) => void
}): {
  app: { make<T>(k: string): T }
  logs: { message: string; context?: Record<string, unknown> }[]
} {
  const logs: { message: string; context?: Record<string, unknown> }[] = []
  const logFn =
    options.logImpl ??
    ((message: string, context?: Record<string, unknown>) => {
      logs.push({ message, context })
    })
  const app = {
    make<T>(key: string): T {
      if (key === 'log') {
        return { error: logFn } as T
      }
      if (key === 'config') {
        return {
          get(k: string): unknown {
            if (k === 'app.debug') {
              return options.debug ?? false
            }
            return undefined
          },
        } as T
      }
      throw new Error(`unexpected make(${key})`)
    },
  }
  return { app, logs }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('ExceptionHandler.report()', () => {
  it('logs error via Log.error()', async () => {
    const { app, logs } = createApp({})
    const handler = new ExceptionHandler(app)
    await handler.report(new Error('boom'), mockReq())
    expect(logs.length).toBe(1)
    expect(logs[0]?.message).toBe('boom')
    expect(logs[0]?.context?.exception).toBe('Error')
  })

  it('skips reporting for dontReport exceptions', async () => {
    const { app, logs } = createApp({})
    const handler = new ExceptionHandler(app)
    await handler.report(new ValidationException({ email: ['required'] }), mockReq())
    expect(logs.length).toBe(0)
  })

  it('skips reporting for ignored exceptions', async () => {
    class TempErr extends Error {
      public constructor() {
        super('temp')
        this.name = 'TempErr'
      }
    }
    const { app, logs } = createApp({})
    const handler = new ExceptionHandler(app)
    handler.ignore(TempErr)
    await handler.report(new TempErr(), mockReq())
    expect(logs.length).toBe(0)
  })

  it('calls custom reportable callbacks', async () => {
    class PayErr extends Error {
      public constructor() {
        super('pay')
        this.name = 'PayErr'
      }
    }
    const { app, logs } = createApp({})
    const handler = new ExceptionHandler(app)
    let saw = false
    handler.reportable(PayErr, () => {
      saw = true
    })
    await handler.report(new PayErr(), mockReq())
    expect(saw).toBe(true)
    expect(logs.length).toBe(1)
  })

  it('calls exception.report() if available (ReportableException)', async () => {
    const { app, logs } = createApp({})
    const handler = new ExceptionHandler(app)
    class Custom extends Error {
      public reportCalls = 0
      public constructor() {
        super('c')
        this.name = 'Custom'
      }
      public report(): void {
        this.reportCalls += 1
      }
    }
    const err = new Custom()
    await handler.report(err, mockReq())
    expect(err.reportCalls).toBe(1)
    expect(logs.length).toBe(0)
  })

  it('includes exception context in log entry', async () => {
    const { app, logs } = createApp({})
    const handler = new ExceptionHandler(app)
    class WithCtx extends Error {
      public constructor() {
        super('x')
        this.name = 'WithCtx'
      }
      public context(): Record<string, unknown> {
        return { orderId: 99 }
      }
    }
    await handler.report(new WithCtx(), mockReq())
    expect(logs[0]?.context?.orderId).toBe(99)
  })

  it('strips dontFlash keys from context', async () => {
    const { app, logs } = createApp({})
    const handler = new ExceptionHandler(app)
    await handler.report(new Error('x'), mockReq())
    const input = logs[0]?.context?.input as Record<string, unknown> | undefined
    expect(input?.name).toBe('Ada')
    expect(input?.password).toBeUndefined()
  })

  it('deduplicates when withoutDuplicates() enabled', async () => {
    const { app, logs } = createApp({})
    const handler = new ExceptionHandler(app)
    handler.withoutDuplicates()
    const err = new Error('same')
    await handler.report(err, mockReq())
    await handler.report(err, mockReq())
    expect(logs.length).toBe(1)
  })

  it('writes to stderr if logging fails (emergency)', async () => {
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const { app } = createApp({
      logImpl: () => {
        throw new Error('log down')
      },
    })
    const handler = new ExceptionHandler(app)
    await handler.report(new Error('original'), mockReq())
    expect(writeSpy.mock.calls.some((c) => String(c[0]).includes('Log failed'))).toBe(true)
  })
})

describe('ExceptionHandler.render()', () => {
  it('returns JSON error for HttpException', async () => {
    const { app } = createApp({})
    const handler = new ExceptionHandler(app)
    const res = mockRes()
    await handler.render(new NotFoundHttpException(), mockReq(), res as Response)
    expect(res._status).toBe(404)
    expect((res._body as { error: { code: string } }).error.code).toBe('NOT_FOUND')
  })

  it('calls exception.render() if available (RenderableException)', async () => {
    const { app } = createApp({})
    const handler = new ExceptionHandler(app)
    const res = mockRes()
    await handler.render(new ValidationHttpException({ a: ['bad'] }), mockReq(), res as Response)
    expect(res._status).toBe(422)
    const body = res._body as { error: { errors: Record<string, string[]> } }
    expect(body.error.errors.a).toEqual(['bad'])
  })

  it('calls custom renderable callback', async () => {
    class R extends Error {
      public constructor() {
        super('r')
        this.name = 'R'
      }
    }
    const { app } = createApp({})
    const handler = new ExceptionHandler(app)
    handler.renderable(R, (_e, _req, res) => res.status(418).json({ tea: true }))
    const res = mockRes()
    await handler.render(new R(), mockReq(), res as Response)
    expect(res._status).toBe(418)
  })

  it('renders ValidationHttpException with error bag', async () => {
    const { app } = createApp({})
    const handler = new ExceptionHandler(app)
    const res = mockRes()
    await handler.render(
      new ValidationHttpException({ email: ['invalid'] }),
      mockReq(),
      res as Response,
    )
    const body = res._body as { error: { errors: Record<string, string[]> } }
    expect(body.error.errors.email).toEqual(['invalid'])
  })

  it('renders AuthenticationException as 401', async () => {
    const { app } = createApp({})
    const handler = new ExceptionHandler(app)
    const err = new Error('Unauthenticated')
    err.name = 'AuthenticationError'
    const res = mockRes()
    await handler.render(err, mockReq(), res as Response)
    expect(res._status).toBe(401)
  })

  it('renders 500 with stack trace in debug mode', async () => {
    const { app } = createApp({ debug: true })
    const handler = new ExceptionHandler(app)
    const res = mockRes()
    const err = new Error('fail')
    await handler.render(err, mockReq(), res as Response)
    const body = res._body as { error: { trace?: string[] } }
    expect(body.error.trace?.length).toBeGreaterThan(0)
  })

  it('renders generic 500 in production mode', async () => {
    const { app } = createApp({ debug: false })
    const handler = new ExceptionHandler(app)
    const res = mockRes()
    await handler.render(new Error('secret internals'), mockReq(), res as Response)
    const body = res._body as { error: { message: string } }
    expect(body.error.message).toBe('Internal Server Error')
  })

  it('includes headers from HttpException', async () => {
    const { app } = createApp({})
    const handler = new ExceptionHandler(app)
    const res = mockRes()
    const setSpy = vi.spyOn(res, 'setHeader')
    await handler.render(
      new HttpException(302, 'Go', { Location: '/x' }),
      mockReq(),
      res as Response,
    )
    expect(setSpy).toHaveBeenCalledWith('Location', '/x')
  })

  it('returns bare 500 if rendering fails', async () => {
    const { app } = createApp({})
    const handler = new ExceptionHandler(app)
    class Bad extends HttpException {
      public constructor() {
        super(400, 'bad')
      }
      public override render(): void {
        throw new Error('render boom')
      }
    }
    const res = mockRes()
    await handler.render(new Bad(), mockReq(), res as Response)
    expect(res._status).toBe(500)
  })
})
