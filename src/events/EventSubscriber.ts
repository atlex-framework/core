import type { EventDispatcher } from './EventDispatcher.js'

/**
 * Subscriber contract for grouping event→listener registrations.
 */
export interface EventSubscriber {
  /**
   * Register event listeners.
   *
   * @param dispatcher - Event dispatcher instance.
   */
  subscribe(dispatcher: EventDispatcher): void
}
