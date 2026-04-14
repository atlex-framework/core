import type { Request, Response } from 'express'

/**
 * If an exception implements this, {@link ExceptionHandler} calls `render()` instead of default rendering.
 */
export interface RenderableException {
  render(req: Request, res: Response): Response | void | Promise<Response | void>
}
