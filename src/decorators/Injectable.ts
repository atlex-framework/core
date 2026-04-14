import 'reflect-metadata'

import { ATLEX_INJECTABLE } from './metadataKeys.js'

/**
 * Marks a class as eligible for container auto-wiring.
 *
 * @returns The class decorator.
 */
export function Injectable(): ClassDecorator {
  return (target: object) => {
    Reflect.defineMetadata(ATLEX_INJECTABLE, true, target)
  }
}
