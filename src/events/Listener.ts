/**
 * Event listener contract.
 *
 * @typeParam TEvent - Event type handled by this listener.
 */
export interface Listener<TEvent = unknown> {
  /**
   * Handle an event.
   *
   * @param event - Dispatched event instance.
   */
  handle(event: TEvent): Promise<void> | void
}
