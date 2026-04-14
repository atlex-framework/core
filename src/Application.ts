import 'reflect-metadata'

import express, { type Express } from 'express'

import { setApplicationContext } from './applicationContext.js'
import { Container, type Factory } from './Container.js'
import { AtlexError } from './errors/AtlexError.js'
import { ExceptionHandler } from './exceptions/Handler.js'
import { runWithHttpContext } from './httpContext.js'
import { handleExceptions } from './middleware/handleExceptions.js'
import { Route } from './Router.js'
import type { ServiceProvider } from './ServiceProvider.js'

export type ListenCallback = () => void

/**
 * HTTP application foundation for Atlex.
 */
export class Application {
  private readonly expressApp: Express
  private readonly providers: ServiceProvider[] = []

  private readonly loadedDeferredProviders = new Set<ServiceProvider>()

  /**
   * The application service container.
   */
  public readonly container: Container

  public constructor() {
    this.expressApp = express()
    this.container = new Container({
      beforeResolveString: (resolvedAbstractKey) => {
        this.loadDeferredProvidersFor(resolvedAbstractKey)
      },
    })
  }

  /**
   * Get the underlying Express app instance.
   */
  public get express(): Express {
    return this.expressApp
  }

  /**
   * Register a service provider (register phase only).
   */
  public register(provider: ServiceProvider): this {
    this.providers.push(provider)
    if (!provider.isDeferred) {
      provider.register(this)
    }
    return this
  }

  /**
   * Resolve a controller for HTTP dispatch: container `make()` when `@Injectable()`, otherwise `new`.
   *
   * @typeParam T - Controller instance type.
   * @param ControllerClass - Controller constructor.
   * @returns Controller instance.
   */
  public resolveController<T extends object>(ControllerClass: new (...args: never[]) => T): T {
    try {
      return this.make(ControllerClass)
    } catch (err) {
      if (err instanceof AtlexError && err.code === 'E_NOT_INJECTABLE') {
        return new ControllerClass()
      }
      throw err
    }
  }

  /**
   * Boot the application (boot all providers, register HTTP context middleware, then bind routes).
   *
   * Registers middleware so {@link response}() and {@link request}() work without passing `res`/`req`.
   * Register body parsers and other global `express.use` **before** `boot()` so they run first.
   */
  public boot(): this {
    setApplicationContext(this)
    for (const provider of this.providers) {
      if (provider.isDeferred) {
        continue
      }
      provider.boot(this)
    }

    if (!this.container.hasBinding('exception.handler')) {
      this.container.singleton('exception.handler', () => new ExceptionHandler(this))
    }

    this.expressApp.use((req, res, next) => {
      runWithHttpContext({ req, res }, () => {
        next()
      })
    })

    Route.bind(this.expressApp, this)

    this.expressApp.use(handleExceptions(() => this.make<ExceptionHandler>('exception.handler')))
    return this
  }

  /**
   * Register a transient binding on the container.
   *
   * @typeParam TValue - Service type.
   * @param abstractKey - Abstract name.
   * @param factory - Factory for new instances.
   * @returns This application (fluent).
   */
  public bind<TValue>(abstractKey: string, factory: Factory<TValue>): this {
    this.container.bind(abstractKey, factory)
    return this
  }

  /**
   * Register a singleton binding on the container.
   *
   * @typeParam TValue - Service type.
   * @param abstractKey - Abstract name.
   * @param factory - Factory invoked once.
   * @returns This application (fluent).
   */
  public singleton<TValue>(abstractKey: string, factory: Factory<TValue>): this {
    this.container.singleton(abstractKey, factory)
    return this
  }

  /**
   * Resolve a string binding from the container.
   *
   * @typeParam TValue - Resolved service type.
   * @param abstractKey - Registered abstract name.
   * @returns The resolved value.
   */
  public make<TValue>(abstractKey: string): TValue

  /**
   * Resolve an `@Injectable()` class with constructor auto-wiring.
   *
   * @typeParam TInstance - Resolved instance type.
   * @param concrete - Injectable class constructor.
   * @returns The resolved instance.
   */
  public make<TInstance extends object>(concrete: new (...args: never[]) => TInstance): TInstance

  public make<TValue>(abstractOrConcrete: string | (new (...args: never[]) => object)): TValue {
    if (typeof abstractOrConcrete === 'string') {
      return this.container.make<TValue>(abstractOrConcrete)
    }
    return this.container.make(abstractOrConcrete as new (...args: unknown[]) => object) as TValue
  }

  /**
   * Load and register the first deferred provider that advertises the given abstract (idempotent per provider).
   *
   * @param abstractKey - Resolved abstract key (after container aliases).
   */
  private loadDeferredProvidersFor(abstractKey: string): void {
    for (const provider of this.providers) {
      if (!provider.isDeferred) {
        continue
      }
      if (this.loadedDeferredProviders.has(provider)) {
        continue
      }
      if (!provider.provides().includes(abstractKey)) {
        continue
      }
      provider.register(this)
      provider.boot(this)
      this.loadedDeferredProviders.add(provider)
      return
    }
  }

  /**
   * Start listening for HTTP requests.
   * Set `HOST=0.0.0.0` in Docker (or compose) so published ports accept traffic.
   */
  public listen(port: number, callback?: ListenCallback): void {
    const host = process.env.HOST
    if (typeof host === 'string' && host.trim().length > 0) {
      this.expressApp.listen(port, host.trim(), () => {
        callback?.()
      })
      return
    }
    this.expressApp.listen(port, () => {
      callback?.()
    })
  }
}

/**
 * Global application singleton.
 */
export const app = new Application()
