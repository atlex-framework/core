import type { NextFunction, Request, Response } from 'express'

import { getApplicationContext } from './applicationContext.js'
import type { ControllerConstructor, RequestHandler } from './Router.js'

/**
 * Optional: bind a controller method by function reference (refactor-safe renames).
 * Prefer tuple form **`[UserController, "index"]`** on {@link Route.get} and friends.
 *
 * @typeParam T - Controller instance type.
 * @param ControllerClass - Controller constructor.
 * @param action - Method reference (e.g. `UserController.prototype.index`).
 * @returns Express middleware compatible with {@link Route.get}.
 */
export function bindControllerAction<T extends object>(
  ControllerClass: ControllerConstructor<T>,
  action: (this: T, req: Request, res: Response, next: NextFunction) => void | Promise<void>,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const application = getApplicationContext()
    const instance = application.resolveController(ControllerClass)
    await action.call(instance, req, res, next)
  }
}
