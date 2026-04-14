import 'reflect-metadata'

import type { Constructor } from '../Container.js'

const LISTEN_METADATA_KEY = 'atlex:listen:events'

/**
 * Global listener registry populated by {@link Listen} decorator.
 */
export class ListenerRegistry {
  private static readonly mapping = new Map<Constructor<object>, Set<Constructor<object>>>()

  /**
   * @param eventClass - Event constructor.
   * @returns Decorated listener constructors registered for the event.
   */
  public static getListeners(eventClass: Constructor<object>): Constructor<object>[] {
    return Array.from(this.mapping.get(eventClass) ?? [])
  }

  /**
   * @returns All event→listeners mappings.
   */
  public static getAllMappings(): Map<Constructor<object>, Set<Constructor<object>>> {
    return this.mapping
  }

  /**
   * @internal
   */
  public static _register(
    eventClass: Constructor<object>,
    listenerClass: Constructor<object>,
  ): void {
    const set = this.mapping.get(eventClass) ?? new Set<Constructor<object>>()
    set.add(listenerClass)
    this.mapping.set(eventClass, set)
  }
}

function normalizeEvents(
  args: (Constructor<object> | Constructor<object>[])[],
): Constructor<object>[] {
  const out: Constructor<object>[] = []
  for (const item of args) {
    if (Array.isArray(item)) out.push(...item)
    else out.push(item)
  }
  return out
}

/**
 * Class decorator that registers a listener for one or more events.
 *
 * Requires `reflect-metadata` to be imported once in the app entry (Atlex does this in {@link Application}).
 *
 * @param events - Event constructors or arrays of constructors.
 */
export function Listen(...events: (Constructor<object> | Constructor<object>[])[]): ClassDecorator {
  return (target) => {
    const listenerClass = target as unknown as Constructor<object>
    const flat = normalizeEvents(events)

    const existing =
      (Reflect.getMetadata(LISTEN_METADATA_KEY, listenerClass) as
        | Constructor<object>[]
        | undefined) ?? []
    const merged = [...existing, ...flat]
    Reflect.defineMetadata(LISTEN_METADATA_KEY, merged, listenerClass)

    for (const eventClass of flat) {
      ListenerRegistry._register(eventClass, listenerClass)
    }
  }
}
