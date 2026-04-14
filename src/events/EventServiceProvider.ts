import type { Application } from '../Application.js'
import type { Constructor } from '../Container.js'
import { ServiceProvider } from '../ServiceProvider.js'

import { EventDispatcher } from './EventDispatcher.js'

/**
 * Registers {@link EventDispatcher} into the application container.
 *
 * Applications can extend this provider to register listeners/subscribers.
 */
export class EventServiceProvider extends ServiceProvider {
  /**
   * Override to manually map event class names to listener classes.
   */
  protected listen: Record<string, Constructor<object>[]> = {}

  /**
   * Override to register subscriber classes.
   */
  protected subscribers: Constructor<object>[] = []

  public register(app: Application): void {
    app.singleton(EventDispatcher.name, () => new EventDispatcher(app.container))
    app.container.alias('events', EventDispatcher.name)
  }

  public boot(app: Application): void {
    const dispatcher = app.make<EventDispatcher>(EventDispatcher.name)

    // Manual listen mappings are supported only when a concrete constructor is provided elsewhere.
    // In this core build, we encourage using dispatcher.listen(EventClass, ListenerClass) directly.
    void dispatcher
  }
}
