import 'reflect-metadata'

import {
  ATLEX_INJECTABLE,
  ATLEX_INJECT_PARAMS,
  ATLEX_SINGLETON,
} from './decorators/metadataKeys.js'
import { AtlexError } from './errors/AtlexError.js'
import { CircularDependencyError } from './errors/CircularDependencyError.js'

export type Factory<T> = () => T

type Binding<T> =
  | { kind: 'factory'; factory: Factory<T> }
  | { kind: 'singleton'; factory: Factory<T>; cached?: T }
  | { kind: 'instance'; value: T }

export type Constructor<T extends object> = new (...args: unknown[]) => T

interface ContextualRule {
  consumer: Constructor<object>
  need: Constructor<object>
  give: Constructor<object>
}

/**
 * Optional hooks for container integration (e.g. deferred service providers).
 */
export interface ContainerOptions {
  /**
   * Invoked before resolving a string abstract (after alias resolution), so callers can register deferred bindings.
   *
   * @param resolvedAbstractKey - Fully alias-resolved abstract key.
   */
  beforeResolveString?: (resolvedAbstractKey: string) => void
}

/**
 * IoC container: bindings, aliases, auto-wiring, contextual rules, and circular detection.
 */
export class Container {
  private readonly bindings = new Map<string, Binding<unknown>>()

  private readonly aliases = new Map<string, string>()

  private readonly classSingletonCache = new Map<Constructor<object>, object>()

  private readonly contextualBindings: ContextualRule[] = []

  private readonly stringResolutionStack: string[] = []

  private readonly beforeResolveString: ((resolvedAbstractKey: string) => void) | undefined

  public constructor(options?: ContainerOptions) {
    this.beforeResolveString = options?.beforeResolveString
  }

  /**
   * Register a transient factory binding.
   *
   * @param abstractKey - Abstract service name.
   * @param factory - Factory invoked on every resolution.
   */
  public bind<T>(abstractKey: string, factory: Factory<T>): void {
    this.bindings.set(abstractKey, { kind: 'factory', factory })
  }

  /**
   * Register a singleton factory binding (instantiated once on first resolve).
   *
   * @param abstractKey - Abstract service name.
   * @param factory - Factory invoked on first resolution only.
   */
  public singleton<T>(abstractKey: string, factory: Factory<T>): void {
    this.bindings.set(abstractKey, { kind: 'singleton', factory })
  }

  /**
   * Bind a pre-built instance.
   *
   * @param abstractKey - Abstract service name.
   * @param value - Concrete instance.
   */
  public instance<T>(abstractKey: string, value: T): void {
    this.bindings.set(abstractKey, { kind: 'instance', value })
  }

  /**
   * Map one abstract name to another (chains are followed on resolve).
   *
   * @param abstractKey - Alias to register.
   * @param targetAbstractKey - Existing abstract key or another alias.
   */
  public alias(abstractKey: string, targetAbstractKey: string): void {
    this.aliases.set(abstractKey, targetAbstractKey)
  }

  /**
   * Whether a binding (or alias chain target) exists for the given abstract key.
   *
   * @param abstractKey - Abstract name or alias.
   */
  public hasBinding(abstractKey: string): boolean {
    const resolved = this.resolveAliasChain(abstractKey)
    return this.bindings.has(resolved)
  }

  /**
   * Fluent contextual binding: when building `consumer`, dependencies typed as `need` resolve to `give`.
   *
   * @param consumer - Class currently being constructed.
   * @returns Builder with `needs` / `give`.
   */
  public when(consumer: Constructor<object>) {
    const container = this
    return {
      /**
       * @param need - Requested dependency type (constructor).
       * @returns Builder with `give`.
       */
      needs(need: Constructor<object>) {
        return {
          /**
           * @param give - Implementation constructor to instantiate instead of `need`.
           */
          give(give: Constructor<object>): void {
            container.contextualBindings.push({ consumer, need, give })
          },
        }
      },
    }
  }

  /**
   * Resolve a string abstract or an `@Injectable()` class.
   *
   * @typeParam TValue - Resolved type.
   * @param abstractKey - Registered abstract name.
   * @returns The resolved service.
   * @throws AtlexError when the abstract is missing or aliases cycle.
   * @throws CircularDependencyError when string bindings recurse in a cycle.
   */
  public make<TValue>(abstractKey: string): TValue

  /**
   * Resolve an `@Injectable()` class with constructor auto-wiring.
   *
   * @typeParam TInstance - Instance type.
   * @param ctor - Injectable class constructor.
   * @returns The resolved instance.
   * @throws AtlexError when metadata is invalid.
   * @throws CircularDependencyError when constructors recurse in a cycle.
   */
  public make<TInstance extends object>(ctor: Constructor<TInstance>): TInstance

  public make<TValue>(abstractOrCtor: string | Constructor<object>): TValue {
    if (typeof abstractOrCtor === 'string') {
      return this.makeFromString<TValue>(abstractOrCtor)
    }
    return this.instantiateInjectable(abstractOrCtor, []) as TValue
  }

  /**
   * @deprecated Prefer {@link Container.make} with a class argument.
   */
  public resolveInjectable<T extends object>(ctor: Constructor<T>): T {
    return this.make(ctor)
  }

  private resolveAliasChain(abstractKey: string): string {
    const visited = new Set<string>()
    let current = abstractKey
    while (this.aliases.has(current)) {
      if (visited.has(current)) {
        throw new AtlexError(`Alias cycle involving "${abstractKey}".`, 'E_ALIAS_CYCLE')
      }
      visited.add(current)
      current = this.aliases.get(current)!
    }
    return current
  }

  private makeFromString<TValue>(abstractKey: string): TValue {
    const resolved = this.resolveAliasChain(abstractKey)
    this.beforeResolveString?.(resolved)

    if (this.stringResolutionStack.includes(resolved)) {
      throw new CircularDependencyError(this.stringResolutionStack.concat(resolved).join(' → '))
    }

    this.stringResolutionStack.push(resolved)
    try {
      const binding = this.bindings.get(resolved)
      if (!binding) {
        throw new AtlexError(
          `Container: nothing bound for "${abstractKey}".`,
          'E_BINDING_NOT_FOUND',
        )
      }

      if (binding.kind === 'instance') {
        return binding.value as TValue
      }

      if (binding.kind === 'factory') {
        return binding.factory() as TValue
      }

      if (binding.cached !== undefined) {
        return binding.cached as TValue
      }

      const value = binding.factory()
      binding.cached = value
      return value as TValue
    } finally {
      this.stringResolutionStack.pop()
    }
  }

  private findContextualGive(
    consumer: Constructor<object>,
    need: Constructor<object>,
  ): Constructor<object> | undefined {
    for (const rule of this.contextualBindings) {
      if (rule.consumer === consumer && rule.need === need) {
        return rule.give
      }
    }
    return undefined
  }

  private instantiateInjectable<T extends object>(
    ctor: Constructor<T>,
    classStack: Constructor<object>[],
  ): T {
    if (!Reflect.getMetadata(ATLEX_INJECTABLE, ctor)) {
      throw new AtlexError(
        `Container: "${ctor.name}" is not marked @Injectable().`,
        'E_NOT_INJECTABLE',
      )
    }

    const isSingleton = Boolean(Reflect.getMetadata(ATLEX_SINGLETON, ctor))
    if (isSingleton) {
      const cached = this.classSingletonCache.get(ctor)
      if (cached !== undefined) {
        return cached as T
      }
    }

    if (classStack.includes(ctor)) {
      throw new CircularDependencyError(
        classStack
          .map((c) => c.name)
          .concat(ctor.name)
          .join(' → '),
      )
    }

    classStack.push(ctor)

    try {
      const paramTypes =
        (Reflect.getMetadata('design:paramtypes', ctor) as (unknown | undefined)[] | undefined) ??
        []

      const injectParams =
        (Reflect.getMetadata(ATLEX_INJECT_PARAMS, ctor) as Record<number, string> | undefined) ?? {}

      const args: unknown[] = []
      for (let i = 0; i < paramTypes.length; i += 1) {
        const tokenOverride = injectParams[i]
        if (tokenOverride !== undefined) {
          args.push(this.makeFromString(tokenOverride))
          continue
        }

        const paramType = paramTypes[i]
        if (paramType === undefined || paramType === Object) {
          throw new AtlexError(
            `Container: cannot infer dependency for parameter ${String(i)} of "${ctor.name}". Use @Inject('token').`,
            'E_UNRESOLVED_PARAM',
          )
        }

        if (typeof paramType !== 'function') {
          throw new AtlexError(
            `Container: unsupported dependency type for parameter ${String(i)} of "${ctor.name}".`,
            'E_UNSUPPORTED_PARAM',
          )
        }

        const needCtor = paramType as Constructor<object>
        const giveCtor = this.findContextualGive(ctor, needCtor) ?? needCtor
        args.push(this.instantiateInjectable(giveCtor, classStack))
      }

      const instance = new ctor(...args)

      if (isSingleton) {
        this.classSingletonCache.set(ctor, instance)
      }

      return instance
    } finally {
      classStack.pop()
    }
  }
}
