import type { NextFunction, Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'

import { ExceptionHandler } from '../../src/exceptions/Handler.js'
import { handleExceptions } from '../../src/middleware/handleExceptions.js'

function mockReq(): Request {
  return {
    method: 'GET',
    url: '/x',
    ip: '127',
    headers: { accept: 'application/json' },
    body: {},
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
    setHeader() {
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
  }
  return res as unknown as Response & { _status: number; _body: unknown }
}

function createHandlerAppPair() {
  const reportSpy = vi.fn()
  const renderSpy = vi.fn()
  class TestHandler extends ExceptionHandler {
    public override async report(error: Error, req?: Request): Promise<void> {
      reportSpy(error, req)
      return super.report(error, req)
    }

    public override async render(
      error: Error,
      req: Request,
      res: Response,
    ): Promise<Response | void> {
      renderSpy(error, req, res)
      return super.render(error, req, res)
    }
  }
  const inner = {
    make<T>(key: string): T {
      if (key === 'log') {
        return { error: () => undefined } as T
      }
      if (key === 'config') {
        return { get: () => false } as T
      }
      throw new Error(key)
    },
  }
  const handler = new TestHandler(inner)
  return { handler, reportSpy, renderSpy }
}

describe('handleExceptions middleware', () => {
  it('catches errors and calls report + render', async () => {
    const { handler, reportSpy, renderSpy } = createHandlerAppPair()
    const mw = handleExceptions(() => handler)
    const req = mockReq()
    const res = mockRes()
    const next = vi.fn() as NextFunction
    await mw(new Error('e'), req, res as Response, next)
    expect(reportSpy).toHaveBeenCalledTimes(1)
    expect(renderSpy).toHaveBeenCalledTimes(1)
    expect(res._status).toBe(500)
  })

  it('handles non-Error throws (strings, objects)', async () => {
    const { handler, reportSpy } = createHandlerAppPair()
    const mw = handleExceptions(() => handler)
    const req = mockReq()
    const res = mockRes()
    const next = vi.fn() as NextFunction
    await mw('stringy', req, res as Response, next)
    expect(reportSpy).toHaveBeenCalled()
    const errArg = reportSpy.mock.calls[0]?.[0] as Error
    expect(errArg).toBeInstanceOf(Error)
    expect(errArg.message).toBe('stringy')
  })

  it('falls back to bare 500 if render fails', async () => {
    const inner = {
      make<T>(key: string): T {
        if (key === 'log') {
          return { error: () => undefined } as T
        }
        if (key === 'config') {
          return { get: () => false } as T
        }
        throw new Error(key)
      },
    }
    const handler = new ExceptionHandler(inner)
    vi.spyOn(handler, 'render').mockRejectedValue(new Error('render dead'))
    const mw = handleExceptions(() => handler)
    const req = mockReq()
    const res = mockRes()
    const next = vi.fn() as NextFunction
    await mw(new Error('x'), req, res as Response, next)
    expect(res._status).toBe(500)
    const body = res._body as { error: { message: string } }
    expect(body.error.message).toBe('Internal Server Error')
  })

  it('writes to stderr if report fails', async () => {
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const inner = {
      make<T>(key: string): T {
        if (key === 'log') {
          return { error: () => undefined } as T
        }
        if (key === 'config') {
          return { get: () => false } as T
        }
        throw new Error(key)
      },
    }
    const handler = new ExceptionHandler(inner)
    vi.spyOn(handler, 'report').mockImplementation(async () => {
      throw new Error('report dead')
    })
    const mw = handleExceptions(() => handler)
    const req = mockReq()
    const res = mockRes()
    const next = vi.fn() as NextFunction
    await mw(new Error('orig'), req, res as Response, next)
    expect(writeSpy.mock.calls.some((c) => String(c[0]).includes('EMERGENCY'))).toBe(true)
  })
})
