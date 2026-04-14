import 'reflect-metadata'

import { describe, expect, it } from 'vitest'

import { Container } from '../src/Container.js'
import { CircularDependencyError } from '../src/errors/CircularDependencyError.js'
import { Inject } from '../src/decorators/Inject.js'
import { Injectable } from '../src/decorators/Injectable.js'
import { Singleton } from '../src/decorators/Singleton.js'

describe('Container.make (class)', () => {
  it('resolves constructor dependencies from design:paramtypes', () => {
    @Injectable()
    class Dep {
      public readonly tag = 'dep'
    }

    @Injectable()
    class Consumer {
      public constructor(public readonly dep: Dep) {}
    }

    const container = new Container()
    const consumer = container.make(Consumer)
    expect(consumer.dep).toBeInstanceOf(Dep)
    expect(consumer.dep.tag).toBe('dep')
  })

  it('uses @Inject token for string bindings', () => {
    @Injectable()
    class ApiClient {
      public constructor(@Inject('api.base') public readonly base: string) {}
    }

    const container = new Container()
    container.bind('api.base', () => 'https://example.test')

    const client = container.make(ApiClient)
    expect(client.base).toBe('https://example.test')
  })

  it('returns the same instance for @Singleton on repeated resolve', () => {
    @Injectable()
    @Singleton()
    class Counter {
      public n = 0
    }

    @Injectable()
    class Holder {
      public constructor(
        public readonly a: Counter,
        public readonly b: Counter,
      ) {}
    }

    const container = new Container()
    const holder = container.make(Holder)
    expect(holder.a).toBe(holder.b)

    const again = container.make(Counter)
    expect(again).toBe(holder.a)
  })

  it('creates new instances for non-singleton injectables', () => {
    @Injectable()
    class Leaf {}

    @Injectable()
    class Root {
      public constructor(
        public readonly left: Leaf,
        public readonly right: Leaf,
      ) {}
    }

    const container = new Container()
    const root = container.make(Root)
    expect(root.left).toBeInstanceOf(Leaf)
    expect(root.right).toBeInstanceOf(Leaf)
    expect(root.left).not.toBe(root.right)
  })

  it('throws when the class is not @Injectable', () => {
    class Raw {}

    const container = new Container()
    expect(() => container.make(Raw)).toThrow(/not marked @Injectable/)
  })

  it('throws CircularDependencyError on circular constructor dependencies', () => {
    @Injectable()
    class CycleA {
      public constructor(..._args: unknown[]) {}
    }

    @Injectable()
    class CycleB {
      public constructor(..._args: unknown[]) {}
    }

    Reflect.defineMetadata('design:paramtypes', [CycleB], CycleA)
    Reflect.defineMetadata('design:paramtypes', [CycleA], CycleB)

    const container = new Container()
    expect(() => container.make(CycleA)).toThrow(CircularDependencyError)
  })

  it('supports resolveInjectable alias to make', () => {
    @Injectable()
    class Svc {}

    const container = new Container()
    expect(container.resolveInjectable(Svc)).toBeInstanceOf(Svc)
  })
})
