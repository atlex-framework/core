import 'reflect-metadata'

import { ATLEX_SINGLETON } from './metadataKeys.js'

/**
 * Marks an {@link Injectable} class as a singleton; the first resolution caches the instance.
 *
 * @returns The class decorator.
 */
export function Singleton(): ClassDecorator {
  return (target: object) => {
    Reflect.defineMetadata(ATLEX_SINGLETON, true, target)
  }
}
