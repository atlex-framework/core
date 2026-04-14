import 'reflect-metadata'

import type { Request, Response } from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Application } from '../src/Application.js'
import { Injectable } from '../src/decorators/Injectable.js'
import { runWithHttpContext } from '../src/httpContext.js'
import { configureResponseSerializer } from '../src/jsonResponseSerializer.js'
import { response } from '../src/response.js'
import { Route } from '../src/Router.js'

describe('response() fluent helper', () => {
  afterEach(() => {
    Route.resetForTests()
  })

  it('chains status().json with explicit res and runs configureResponseSerializer', () => {
    configureResponseSerializer((body: unknown) => ({ payload: body }))

    const json = vi.fn()
    const chain = { json }
    const status = vi.fn().mockReturnValue(chain)
    const res = { status } as unknown as Response

    response(res).status(201).json({ a: 1 })

    expect(status).toHaveBeenCalledWith(201)
    expect(json).toHaveBeenCalledWith({ payload: { a: 1 } })
  })

  it('response() without res uses AsyncLocalStorage HTTP context', () => {
    configureResponseSerializer((body: unknown) => body)

    const json = vi.fn()
    const chain = { json }
    const status = vi.fn().mockReturnValue(chain)
    const res = { status } as unknown as Response
    const req = {} as Request

    runWithHttpContext({ req, res }, () => {
      response().status(202).json({ ok: true })
    })

    expect(status).toHaveBeenCalledWith(202)
    expect(json).toHaveBeenCalledWith({ ok: true })
  })

  it('throws when response() is used with no args outside HTTP context', () => {
    expect(() => {
      response().json({})
    }).toThrow(/No HTTP context/)
  })

  it('[Controller, "method"] resolves via container and response() works', async () => {
    configureResponseSerializer((x) => x)

    @Injectable()
    class Hit {
      public async index(): Promise<void> {
        response().json({ hit: true })
      }
    }

    Route.get('/hit', [Hit, 'index'])

    const app = new Application()
    app.boot()

    await new Promise<void>((resolve, reject) => {
      const server = app.express.listen(0, '127.0.0.1', () => {
        const addr = server.address()
        if (addr === null || typeof addr === 'string') {
          reject(new Error('address'))
          return
        }
        void fetch(`http://127.0.0.1:${addr.port}/hit`)
          .then(async (r) => {
            expect(r.status).toBe(200)
            const body = (await r.json()) as { hit: boolean }
            expect(body.hit).toBe(true)
          })
          .then(() => server.close(() => resolve()))
          .catch(reject)
      })
    })
  })
})
