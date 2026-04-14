import { describe, expect, it } from 'vitest'

import { Application } from '../src/Application.js'
import { AtlexError } from '../src/errors/AtlexError.js'
import { Route } from '../src/Router.js'

describe('@atlex/core examples', () => {
  it('Application exposes container', () => {
    const app = new Application()
    expect(app.container).toBeDefined()
  })

  it('AtlexError carries code', () => {
    const e = new AtlexError('x', 'E_TEST')
    expect(e.code).toBe('E_TEST')
  })

  it('Route registers get handler', () => {
    const app = new Application()
    Route.get('/x', (_req, res) => {
      res.status(204).end()
    })
    app.boot()
    expect(app.express).toBeDefined()
  })

  it('Application boot is idempotent-ish', () => {
    const app = new Application()
    app.boot()
    expect(typeof app.listen).toBe('function')
  })

  it('express getter returns function stack', () => {
    const app = new Application()
    expect(typeof app.express.use).toBe('function')
  })
})
