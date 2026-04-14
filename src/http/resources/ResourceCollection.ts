import type { Request } from 'express'

import { request } from '../../request.js'

import type { JsonResource } from './JsonResource.js'

/**
 * Wraps a collection of resources for consistent JSON output.
 *
 * By default, wraps into `{ data: [...] }` (inherits wrap behavior from {@link JsonResource}).
 */
export class ResourceCollection<TItem = unknown> {
  public static wrap: string | null = 'data'

  public constructor(
    private readonly items: readonly TItem[],
    private readonly itemResource: (new (resource: TItem) => JsonResource<TItem>) | null = null,
  ) {}

  public toArray(req: Request): unknown[] {
    if (this.itemResource === null) {
      return [...this.items]
    }
    const Resource = this.itemResource
    return this.items.map((item) => new Resource(item).resolve(req))
  }

  public toResponseObject(req: Request = request()): unknown {
    const wrap = (this.constructor as typeof ResourceCollection).wrap
    const value = this.toArray(req)
    if (wrap === null) {
      return value
    }
    return { [wrap]: value }
  }
}
