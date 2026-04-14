import type { Constructor } from '../../Container.js'

import { EventException } from './EventException.js'

/**
 * Thrown when a listener fails while handling an event.
 */
export class ListenerException extends EventException {
  public constructor(
    public readonly listenerClass: Constructor<object>,
    public override readonly event: object,
    cause: unknown,
  ) {
    super(
      `Listener [${listenerClass.name}] failed while handling [${event.constructor.name}].`,
      cause,
      event,
    )
    this.name = 'ListenerException'
  }
}
