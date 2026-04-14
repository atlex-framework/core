import 'reflect-metadata'

import type { Request, Response } from 'express'
import { afterEach, describe, expect, it } from 'vitest'

import { Application } from '../src/Application.js'
import { Injectable } from '../src/decorators/Injectable.js'
import { Route } from '../src/Router.js'

describe('Route names, middleware groups, patch', () => {
  afterEach(() => {
    Route.resetForTests()
  })

  it('registers named routes and resolves them', () => {
    Route.get('/items', (_req, res) => res.end(), { name: 'items.index' })
    const named = Route.getNamedRoute('items.index')
    expect(named?.method).toBe('get')
    expect(named?.path).toBe('/items')
  })

  it('throws on duplicate route names', () => {
    Route.get('/a', (_req, res) => res.end(), { name: 'dup' })
    expect(() => Route.get('/b', (_req, res) => res.end(), { name: 'dup' })).toThrow(
      /duplicate route name/,
    )
  })

  it('applies middleware from Route.middleware([...]).group()', async () => {
    let saw = false
    Route.middleware('tag', (_req, _res, next) => {
      saw = true
      next()
    })

    Route.middleware(['tag']).group(() => {
      Route.get('/mw', (_req, res) => res.status(200).send('ok'))
    })

    const app = new Application()
    app.boot()

    await new Promise<void>((resolve, reject) => {
      const server = app.express.listen(0, '127.0.0.1', () => {
        const addr = server.address()
        if (addr === null || typeof addr === 'string') {
          reject(new Error('address'))
          return
        }
        void fetch(`http://127.0.0.1:${addr.port}/mw`)
          .then((r) => {
            expect(r.status).toBe(200)
            expect(saw).toBe(true)
          })
          .then(() => server.close(() => resolve()))
          .catch(reject)
      })
    })
  })

  it('registers PATCH routes', async () => {
    @Injectable()
    class P {
      public async x(_req: Request, res: Response): Promise<void> {
        res.status(200).send('p')
      }
    }

    Route.patch('/p', [P, 'x'])
    const app = new Application()
    app.boot()

    await new Promise<void>((resolve, reject) => {
      const server = app.express.listen(0, '127.0.0.1', () => {
        const addr = server.address()
        if (addr === null || typeof addr === 'string') {
          reject(new Error('address'))
          return
        }
        void fetch(`http://127.0.0.1:${addr.port}/p`, { method: 'PATCH' })
          .then((r) => {
            expect(r.status).toBe(200)
          })
          .then(() => server.close(() => resolve()))
          .catch(reject)
      })
    })
  })
})
