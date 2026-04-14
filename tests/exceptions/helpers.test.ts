import { describe, expect, it } from 'vitest'

import { HttpException } from '../../src/exceptions/HttpException.js'
import { abort, abort_if, abort_unless } from '../../src/exceptions/helpers.js'
import { ForbiddenHttpException } from '../../src/exceptions/ForbiddenHttpException.js'
import { NotFoundHttpException } from '../../src/exceptions/NotFoundHttpException.js'

describe('abort helpers', () => {
  it('abort(404) throws NotFoundHttpException', () => {
    expect(() => abort(404)).toThrow(NotFoundHttpException)
  })

  it('abort(403, "msg") throws with custom message', () => {
    try {
      abort(403, 'Nope')
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenHttpException)
      expect((e as ForbiddenHttpException).message).toBe('Nope')
    }
  })

  it('abort_if(true, 404) throws', () => {
    expect(() => abort_if(true, 404)).toThrow(NotFoundHttpException)
  })

  it('abort_if(false, 404) does not throw', () => {
    expect(() => abort_if(false, 404)).not.toThrow()
  })

  it('abort_unless(true, 404) does not throw', () => {
    expect(() => abort_unless(true, 404)).not.toThrow()
  })

  it('abort_unless(false, 404) throws', () => {
    expect(() => abort_unless(false, 404)).toThrow(NotFoundHttpException)
  })

  it('abort(httpException) rethrows the instance', () => {
    const ex = new HttpException(502, 'Bad Gateway')
    expect(() => abort(ex)).toThrow(ex)
  })
})
