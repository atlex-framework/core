import 'reflect-metadata'

import { afterEach, describe, expect, it } from 'vitest'

import { Application } from '../src/Application.js'
import { bodyParser } from '../src/middleware/bodyParser.js'
import { Route } from '../src/Router.js'
import { request } from '../src/request.js'
import { response } from '../src/response.js'
import { FormRequest } from '../src/http/requests/FormRequest.js'
import { JsonResource } from '../src/http/resources/JsonResource.js'
import { Validator } from '../src/validation/Validator.js'

describe('FormRequest, JsonResource, and request().validate', () => {
  afterEach(() => {
    Route.resetForTests()
  })

  it('JsonResource wraps into {data: ...} by default', async () => {
    class UserResource extends JsonResource<{ id: number }> {
      public override toArray(): Record<string, unknown> {
        return { id: this.resource.id }
      }
    }

    class C {
      public async index(): Promise<void> {
        response().json(new UserResource({ id: 1 }))
      }
    }

    Route.get('/r1', [C, 'index'])
    const app = new Application()
    app.boot()

    await new Promise<void>((resolve, reject) => {
      const server = app.express.listen(0, '127.0.0.1', () => {
        const addr = server.address()
        if (addr === null || typeof addr === 'string') {
          reject(new Error('address'))
          return
        }
        void fetch(`http://127.0.0.1:${addr.port}/r1`)
          .then(async (r) => {
            expect(r.status).toBe(200)
            const body = (await r.json()) as { data: { id: number } }
            expect(body.data.id).toBe(1)
          })
          .then(() => server.close(() => resolve()))
          .catch(reject)
      })
    })
  })

  it('FormRequest.validate() returns validated() data and 422 on failure', async () => {
    class StoreUserRequest extends FormRequest {
      public override rules(): Record<string, string> {
        return { email: 'required|string|email' }
      }
    }

    class C {
      public async store(): Promise<void> {
        const data = (await StoreUserRequest.validate()).validated()
        response().status(201).json(data)
      }

      public async fail(): Promise<void> {
        await StoreUserRequest.validate()
        response().json({ ok: true })
      }

      public async echo(): Promise<void> {
        response().json({ got: request().body })
      }
    }

    const app = new Application()
    app.express.use(...bodyParser())
    Route.post('/ok', [C, 'store'])
    Route.post('/fail', [C, 'fail'])
    Route.post('/echo', [C, 'echo'])
    app.boot()

    await new Promise<void>((resolve, reject) => {
      const server = app.express.listen(0, '127.0.0.1', () => {
        const addr = server.address()
        if (addr === null || typeof addr === 'string') {
          reject(new Error('address'))
          return
        }
        const base = `http://127.0.0.1:${addr.port}`

        void fetch(`${base}/ok`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'a@example.com', extra: 'ignored' }),
        })
          .then(async (r) => {
            expect(r.status).toBe(201)
            const body = (await r.json()) as { email: string }
            expect(body.email).toBe('a@example.com')
            expect((body as unknown as Record<string, unknown>).extra).toBeUndefined()
          })
          .then(() =>
            fetch(`${base}/fail`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ email: 'not-an-email' }),
            }),
          )
          .then(async (r) => {
            expect(r.status).toBe(422)
            const body = (await r.json()) as {
              error: { message: string; errors: Record<string, string[]> }
            }
            expect(body.error.message).toMatch(/invalid/i)
            expect(body.error.errors.email?.length).toBeGreaterThan(0)
          })
          .then(() => server.close(() => resolve()))
          .catch((err: unknown) => {
            server.close(() => reject(err instanceof Error ? err : new Error(String(err))))
          })
      })
    })
  })

  it('request().validate(rules, messages) works inline (no FormRequest)', async () => {
    class C {
      public async store(): Promise<void> {
        const data = request().validate(
          { email: 'required|string|email' },
          { 'email.required': 'We need an email.', 'email.email': 'That email is not valid.' },
        )
        response().status(201).json(data)
      }

      public async fail(): Promise<void> {
        request().validate(
          { email: 'required|string|email' },
          { 'email.required': 'We need an email.', 'email.email': 'That email is not valid.' },
        )
        response().json({ ok: true })
      }

      public async merge(): Promise<void> {
        const data = request().validate({ id: 'required|string', name: 'required|string' })
        response().json(data)
      }
    }

    const app = new Application()
    app.express.use(...bodyParser())
    Route.post('/vr-ok', [C, 'store'])
    Route.post('/vr-fail', [C, 'fail'])
    Route.post('/users/:id/vr-merge', [C, 'merge'])
    app.boot()

    await new Promise<void>((resolve, reject) => {
      const server = app.express.listen(0, '127.0.0.1', () => {
        const addr = server.address()
        if (addr === null || typeof addr === 'string') {
          reject(new Error('address'))
          return
        }
        const base = `http://127.0.0.1:${addr.port}`

        void fetch(`${base}/vr-ok`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'b@example.com' }),
        })
          .then(async (r) => {
            expect(r.status).toBe(201)
            const body = (await r.json()) as { email: string }
            expect(body.email).toBe('b@example.com')
          })
          .then(() =>
            fetch(`${base}/vr-fail`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({}),
            }),
          )
          .then(async (r) => {
            expect(r.status).toBe(422)
            const body = (await r.json()) as { error: { errors: Record<string, string[]> } }
            expect(body.error.errors.email?.[0]).toBe('We need an email.')
          })
          .then(() =>
            fetch(`${base}/users/u42/vr-merge`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ name: 'Ann' }),
            }),
          )
          .then(async (r) => {
            expect(r.status).toBe(200)
            const body = (await r.json()) as { id: string; name: string }
            expect(body.id).toBe('u42')
            expect(body.name).toBe('Ann')
          })
          .then(() => server.close(() => resolve()))
          .catch((err: unknown) => {
            server.close(() => reject(err instanceof Error ? err : new Error(String(err))))
          })
      })
    })
  })

  it('Validator.validate(data, rules) works outside HTTP context', () => {
    const data = Validator.validate({ x: 7 }, { x: 'required|integer' })
    expect(data.x).toBe(7)
  })
})
