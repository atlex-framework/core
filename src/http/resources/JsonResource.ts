import type { Request } from 'express'

import { request } from '../../request.js'

import { ResourceCollection } from './ResourceCollection.js'

export type JsonResourceObject = Record<string, unknown>

/**
 * JSON resource transformer for HTTP responses.
 *
 * By default serialized output is wrapped under a `data` key; set `wrap = null` on a subclass to disable.
 */
export abstract class JsonResource<TResource = unknown> {
  public static wrap: string | null = 'data'

  protected readonly resource: TResource

  public constructor(resource: TResource) {
    this.resource = resource
  }

  /**
   * Transform the underlying resource into a plain object.
   */
  public abstract toArray(req: Request): JsonResourceObject

  /**
   * Resolve the resource using the current request context (or an explicit `req`).
   */
  public resolve(req: Request = request()): JsonResourceObject {
    return this.toArray(req)
  }

  /**
   * Resolve with wrapping (`{ data: ... }` by default).
   */
  public toResponseObject(req: Request = request()): unknown {
    const wrap = (this.constructor as typeof JsonResource).wrap
    const value = this.resolve(req)
    if (wrap === null) {
      return value
    }
    return { [wrap]: value }
  }

  /**
   * Create a collection wrapper for an array of items.
   */
  public static collection<TItem>(
    this: new (resource: TItem) => JsonResource<TItem>,
    items: readonly TItem[],
  ): ResourceCollection<TItem> {
    return new ResourceCollection(items, this)
  }
}
