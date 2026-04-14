import { describe, expect, it } from 'vitest'

import { HttpException } from '../../src/exceptions/HttpException.js'
import { NotFoundHttpException } from '../../src/exceptions/NotFoundHttpException.js'

describe('HttpException', () => {
  it('creates exception with correct status code and message', () => {
    const e = new HttpException(418, "I'm a teapot", { 'X-Tea': 'earl-grey' }, 'TEAPOT')
    expect(e.statusCode).toBe(418)
    expect(e.message).toBe("I'm a teapot")
    expect(e.headers['X-Tea']).toBe('earl-grey')
    expect(e.code).toBe('TEAPOT')
  })

  it('uses default message when none provided', () => {
    const e = new HttpException(404)
    expect(e.message).toBe('Not Found')
  })

  it('includes custom headers', () => {
    const e = new HttpException(302, 'Moved', { Location: '/here' })
    expect(e.headers.Location).toBe('/here')
  })

  it('serializes with default code when omitted', () => {
    const e = new NotFoundHttpException()
    expect(e.code).toBe('NOT_FOUND')
    expect(e.statusCode).toBe(404)
  })
})
