import { JsonResource } from './http/resources/JsonResource.js'
import { ResourceCollection } from './http/resources/ResourceCollection.js'
import { tryGetHttpContext } from './httpContext.js'

let serializer: (data: unknown) => unknown = (data) => data

/**
 * Register a global JSON body transformer for {@link response}. Use {@link serializeForHttp} from `@atlex/orm` when returning models from controllers.
 *
 * @param fn - Maps controller data to JSON-safe values before Express `res.json`.
 */
export function configureResponseSerializer(fn: (data: unknown) => unknown): void {
  serializer = fn
}

/**
 * @internal
 */
export function serializeJsonBody(data: unknown): unknown {
  const ctx = tryGetHttpContext()
  if (data instanceof JsonResource) {
    return serializer(data.toResponseObject(ctx?.req))
  }
  if (data instanceof ResourceCollection) {
    return serializer(data.toResponseObject(ctx?.req))
  }
  return serializer(data)
}

/**
 * @internal
 */
export function resetResponseSerializerForTests(): void {
  serializer = (data) => data
}
