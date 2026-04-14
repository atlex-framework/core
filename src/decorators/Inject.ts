import 'reflect-metadata'

import { ATLEX_INJECT_PARAMS } from './metadataKeys.js'

/**
 * Resolves the constructor from a parameter-decorator target (prototype or constructor).
 *
 * @param target - Decorator `target` for a constructor parameter.
 * @returns The class constructor.
 * @throws Error when the constructor cannot be determined.
 */
function constructorFromParameterTarget(target: object): new (...args: unknown[]) => unknown {
  if (typeof target === 'function') {
    return target as new (...args: unknown[]) => unknown
  }

  const proto = target as { constructor?: new (...args: unknown[]) => unknown }
  if (typeof proto.constructor === 'function' && proto.constructor !== Object) {
    return proto.constructor
  }

  throw new Error('Inject: unable to resolve constructor from decorator target.')
}

/**
 * Overrides the container token for a constructor parameter.
 *
 * @param token - Abstract binding name registered on the container.
 * @returns The parameter decorator.
 */
export function Inject(token: string): ParameterDecorator {
  return (target: object, _propertyKey: string | symbol | undefined, parameterIndex: number) => {
    const ctor = constructorFromParameterTarget(target)
    const map =
      (Reflect.getOwnMetadata(ATLEX_INJECT_PARAMS, ctor) as Record<number, string> | undefined) ??
      {}
    const next = { ...map, [parameterIndex]: token }
    Reflect.defineMetadata(ATLEX_INJECT_PARAMS, next, ctor)
  }
}
