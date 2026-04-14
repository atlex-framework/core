import 'reflect-metadata'

import { describe, expect, it } from 'vitest'

import { Application } from '../src/Application.js'
import { Container } from '../src/Container.js'
import { AtlexError } from '../src/errors/AtlexError.js'
import { CircularDependencyError } from '../src/errors/CircularDependencyError.js'
import { Injectable } from '../src/decorators/Injectable.js'
import { ServiceProvider } from '../src/ServiceProvider.js'

describe('Container string bindings', () => {
  it('bind is transient', () => {
    const c = new Container()
    let n = 0
    c.bind('id', () => {
      n += 1
      return n
    })
    expect(c.make<number>('id')).toBe(1)
    expect(c.make<number>('id')).toBe(2)
  })

  it('singleton caches one instance', () => {
    const c = new Container()
    let n = 0
    c.singleton('shared', () => {
      n += 1
      return { n }
    })
    const a = c.make<{ n: number }>('shared')
    const b = c.make<{ n: number }>('shared')
    expect(a).toBe(b)
    expect(a.n).toBe(1)
  })

  it('instance returns the bound value', () => {
    const c = new Container()
    const cfg = { env: 'test' }
    c.instance('config', cfg)
    expect(c.make<typeof cfg>('config')).toBe(cfg)
  })

  it('alias forwards resolution', () => {
    const c = new Container()
    c.bind('db', () => 'postgres')
    c.alias('database', 'db')
    expect(c.make<string>('database')).toBe('postgres')
  })

  it('throws CircularDependencyError for cyclic string factories', () => {
    const c = new Container()
    c.bind('a', () => c.make<string>('b'))
    c.bind('b', () => c.make<string>('a'))
    expect(() => c.make('a')).toThrow(CircularDependencyError)
  })

  it('throws AtlexError on alias cycle', () => {
    const c = new Container()
    c.alias('x', 'y')
    c.alias('y', 'x')
    expect(() => c.make('x')).toThrow(AtlexError)
  })
})

describe('Container contextual bindings', () => {
  it('when().needs().give swaps implementation per consumer', () => {
    @Injectable()
    abstract class IStorage {
      public abstract kind: string
    }

    @Injectable()
    class S3Storage extends IStorage {
      public kind = 's3'
    }

    @Injectable()
    class DiskStorage extends IStorage {
      public kind = 'disk'
    }

    @Injectable()
    class PhotoController {
      public constructor(public readonly storage: IStorage) {}
    }

    @Injectable()
    class ReportController {
      public constructor(public readonly storage: IStorage) {}
    }

    const c = new Container()
    c.when(PhotoController).needs(IStorage).give(S3Storage)
    c.when(ReportController).needs(IStorage).give(DiskStorage)

    const photo = c.make(PhotoController)
    const report = c.make(ReportController)

    expect(photo.storage.kind).toBe('s3')
    expect(report.storage.kind).toBe('disk')
  })
})

describe('Application deferred ServiceProvider', () => {
  it('defers register/boot until a provided abstract is resolved', () => {
    let registered = 0
    let booted = 0

    class LazyProvider extends ServiceProvider {
      public override isDeferred = true

      public override provides(): string[] {
        return ['lazy.token']
      }

      public register(app: Application): void {
        registered += 1
        app.container.bind('lazy.token', () => 'loaded')
      }

      public boot(app: Application): void {
        void app
        booted += 1
      }
    }

    const app = new Application()
    app.register(new LazyProvider())
    app.boot()

    expect(registered).toBe(0)
    expect(booted).toBe(0)

    expect(app.make<string>('lazy.token')).toBe('loaded')
    expect(registered).toBe(1)
    expect(booted).toBe(1)
  })
})

describe('Application container delegation', () => {
  it('bind and singleton forward to the container', () => {
    const app = new Application()
    app.bind('t', () => 1)
    app.singleton('s', () => ({ v: 2 }))
    expect(app.make<number>('t')).toBe(1)
    expect(app.make<{ v: number }>('s').v).toBe(2)
  })
})
