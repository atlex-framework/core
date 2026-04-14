import 'reflect-metadata'

import type { Request, Response } from 'express'
import { describe, expect, it } from 'vitest'

import { Application } from '../src/Application.js'
import { Injectable } from '../src/decorators/Injectable.js'
import { Route } from '../src/Router.js'

describe('Route class controller + Application.make', () => {
  it('resolves the controller from the application container per request', async () => {
    let constructed = 0

    @Injectable()
    class HitService {
      public ping(): string {
        return 'pong'
      }
    }

    @Injectable()
    class HitController {
      public constructor(public readonly svc: HitService) {
        constructed += 1
      }

      public async index(req: Request, res: Response): Promise<void> {
        res.status(200).json({ msg: this.svc.ping(), path: req.path })
      }
    }

    const application = new Application()
    Route.get('/__router_di_hit', [HitController, 'index'])
    application.boot()

    await new Promise<void>((resolve, reject) => {
      const server = application.express.listen(0, '127.0.0.1', () => {
        try {
          const address = server.address()
          if (address === null || typeof address === 'string') {
            reject(new Error('Unexpected server address'))
            return
          }

          const port = address.port
          void fetch(`http://127.0.0.1:${port}/__router_di_hit`)
            .then(async (r) => {
              expect(r.status).toBe(200)
              const body = (await r.json()) as { msg: string; path: string }
              expect(body.msg).toBe('pong')
              expect(body.path).toBe('/__router_di_hit')
            })
            .then(() => {
              server.close(() => resolve())
            })
            .catch((err: unknown) => {
              server.close(() => reject(err instanceof Error ? err : new Error(String(err))))
            })
        } catch (e) {
          server.close(() => reject(e instanceof Error ? e : new Error(String(e))))
        }
      })
    })

    expect(constructed).toBe(1)
  })
})
