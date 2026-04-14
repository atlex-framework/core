import type { Express, NextFunction, Request, Response } from 'express'

import type { Application } from './Application.js'
import { resetApplicationContextForTests } from './applicationContext.js'
import { resetResponseSerializerForTests } from './jsonResponseSerializer.js'

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch'

export type RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>

export type ControllerConstructor<TInstance extends object = object> = new (
  ...args: never[]
) => TInstance

export type ControllerTuple<
  TController extends ControllerConstructor,
  TMethodName extends keyof InstanceType<TController> & string,
> = [TController, TMethodName]

/**
 * - A normal Express handler.
 * - **`[Controller, "method"]`** — class + method name; the application resolves the controller per request.
 */
export type RouteAction = RequestHandler | ControllerTuple<ControllerConstructor, string>

/**
 * Optional metadata when registering a route.
 */
export interface RouteOptions {
  /** Named route key for reverse lookup (e.g. `users.index`). */
  name?: string
  /** Registered middleware names applied after any group middleware. */
  middleware?: string[]
}

interface RouteRecord {
  method: HttpMethod
  path: string
  action: RouteAction
  middlewareNames: string[]
  name?: string
}

interface NamedRouteEntry {
  method: HttpMethod
  path: string
}

/**
 * Fluent routing API with groups, named routes, and middleware aliases.
 */
export class Route {
  private static readonly routes: RouteRecord[] = []
  private static readonly namedMiddleware = new Map<string, RequestHandler>()
  private static readonly namedRoutes = new Map<string, NamedRouteEntry>()
  private static readonly groupPrefixStack: string[] = []
  private static readonly groupMiddlewareStack: string[][] = []
  private static application: Application | null = null

  /**
   * Register a named middleware alias (two-argument form).
   *
   * @param name - Alias used in {@link RouteOptions.middleware} and middleware groups.
   * @param handler - Express middleware.
   */
  public static middleware(name: string, handler: RequestHandler): void

  /**
   * Apply middleware aliases to routes registered inside `group` (single-argument form).
   *
   * @param names - One or more registered middleware names.
   * @returns Object with `group` callback.
   */
  public static middleware(names: string | readonly string[]): {
    group: (callback: () => void) => void
  }

  public static middleware(
    nameOrNames: string | readonly string[],
    handler?: RequestHandler,
  ): void | { group: (callback: () => void) => void } {
    if (typeof handler === 'function') {
      if (typeof nameOrNames !== 'string') {
        throw new Error(
          'Route.middleware: to register a handler, pass a string name as the first argument.',
        )
      }
      this.namedMiddleware.set(nameOrNames, handler)
      return
    }

    const list = Array.isArray(nameOrNames) ? [...nameOrNames] : [nameOrNames]
    return {
      group: (callback: () => void) => {
        this.groupMiddlewareStack.push(list)
        try {
          callback()
        } finally {
          this.groupMiddlewareStack.pop()
        }
      },
    }
  }

  /**
   * Create a route group with a shared path prefix.
   *
   * @param prefix - URL prefix (leading `/` optional).
   * @param callback - Nested route registrations.
   */
  public static group(prefix: string, callback: () => void): void {
    const normalized = prefix.startsWith('/') ? prefix : `/${prefix}`
    this.groupPrefixStack.push(normalized)
    try {
      callback()
    } finally {
      this.groupPrefixStack.pop()
    }
  }

  /**
   * Register a GET route.
   *
   * @param path - URL path.
   * @param handler - Closure or `[Controller, 'method']` tuple.
   * @param options - Optional name and per-route middleware.
   */
  public static get(path: string, handler: RouteAction, options?: RouteOptions): void {
    this.add('get', path, handler, options)
  }

  /**
   * Register a POST route.
   *
   * @param path - URL path.
   * @param handler - Closure or controller tuple.
   * @param options - Optional name and middleware.
   */
  public static post(path: string, handler: RouteAction, options?: RouteOptions): void {
    this.add('post', path, handler, options)
  }

  /**
   * Register a PUT route.
   *
   * @param path - URL path.
   * @param handler - Closure or controller tuple.
   * @param options - Optional name and middleware.
   */
  public static put(path: string, handler: RouteAction, options?: RouteOptions): void {
    this.add('put', path, handler, options)
  }

  /**
   * Register a PATCH route.
   *
   * @param path - URL path.
   * @param handler - Closure or controller tuple.
   * @param options - Optional name and middleware.
   */
  public static patch(path: string, handler: RouteAction, options?: RouteOptions): void {
    this.add('patch', path, handler, options)
  }

  /**
   * Register a DELETE route.
   *
   * @param path - URL path.
   * @param handler - Closure or controller tuple.
   * @param options - Optional name and middleware.
   */
  public static delete(path: string, handler: RouteAction, options?: RouteOptions): void {
    this.add('delete', path, handler, options)
  }

  /**
   * Look up a named route (path as registered, including group prefixes).
   *
   * @param name - Name from {@link RouteOptions.name}.
   * @returns Method + path, or `undefined` if unknown.
   */
  public static getNamedRoute(name: string): NamedRouteEntry | undefined {
    return this.namedRoutes.get(name)
  }

  /**
   * Clear all registrations (intended for tests).
   */
  public static resetForTests(): void {
    this.routes.length = 0
    this.namedMiddleware.clear()
    this.namedRoutes.clear()
    this.groupPrefixStack.length = 0
    this.groupMiddlewareStack.length = 0
    this.application = null
    resetApplicationContextForTests()
    resetResponseSerializerForTests()
  }

  /**
   * Attach registered routes to an Express application.
   *
   * @param expressApp - Target Express instance.
   * @param application - Owning application (used to resolve class controllers).
   */
  public static bind(expressApp: Express, application: Application): void {
    this.application = application
    for (const route of this.routes) {
      const middlewareFns = route.middlewareNames.map((name) => {
        const mw = this.namedMiddleware.get(name)
        if (!mw) {
          throw new Error(`Route: unknown middleware "${name}".`)
        }
        return mw
      })

      const handler = this.toExpressHandler(route.action)
      expressApp[route.method](route.path, ...middlewareFns, handler)
    }
  }

  private static flattenGroupMiddleware(): string[] {
    return this.groupMiddlewareStack.flat()
  }

  private static add(
    method: HttpMethod,
    path: string,
    action: RouteAction,
    options?: RouteOptions,
  ): void {
    const prefixedPath = this.applyGroupPrefix(path)
    const routeMiddleware = options?.middleware ?? []
    const middlewareNames = [...this.flattenGroupMiddleware(), ...routeMiddleware]

    const record: RouteRecord = {
      method,
      path: prefixedPath,
      action,
      middlewareNames,
    }

    if (options?.name !== undefined && options.name.length > 0) {
      if (this.namedRoutes.has(options.name)) {
        throw new Error(`Route: duplicate route name "${options.name}".`)
      }
      record.name = options.name
      this.namedRoutes.set(options.name, { method, path: prefixedPath })
    }

    this.routes.push(record)
  }

  private static applyGroupPrefix(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`
    const prefix = this.groupPrefixStack.join('')
    const joined = `${prefix}${normalized}`
    return joined.replace(/\/{2,}/g, '/')
  }

  private static toExpressHandler(action: RouteAction): RequestHandler {
    if (typeof action === 'function') {
      return action
    }

    const [ControllerClass, methodName] = action

    return async (req, res, next) => {
      const application = this.application
      if (!application) {
        throw new Error(
          'Route: Application not bound. Call Route.bind(expressApp, application) from Application.boot().',
        )
      }

      const instance = application.resolveController(ControllerClass)

      const controller = instance as Record<string, unknown>
      const method = controller[methodName]
      if (typeof method !== 'function') {
        throw new Error(`Route: controller method "${methodName}" is not a function.`)
      }

      const fn = method as (req: Request, res: Response, next: NextFunction) => void | Promise<void>

      await fn.call(instance, req, res, next)
    }
  }
}
