import 'reflect-metadata'

import { describe, expect, it } from 'vitest'

import { Application } from '../src/Application.js'
import { Injectable } from '../src/decorators/Injectable.js'

describe('Application.make', () => {
  it('delegates string keys to the container', () => {
    const application = new Application()
    application.container.bind('greeting', () => 'hello')

    expect(application.make<string>('greeting')).toBe('hello')
  })

  it('resolves @Injectable classes', () => {
    @Injectable()
    class Svc {}

    const application = new Application()
    expect(application.make(Svc)).toBeInstanceOf(Svc)
  })
})
