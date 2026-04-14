import crypto from 'node:crypto'

/**
 * Optional base class for events.
 *
 * Events do not need to extend this class — plain classes work. Extending `Event`
 * provides propagation control and tracing metadata.
 */
export abstract class Event {
  /**
   * Halt propagation to remaining listeners after current one.
   */
  public propagationStopped = false

  /**
   * UTC timestamp of when the event was created.
   */
  public readonly dispatchedAt: Date = new Date()

  /**
   * Unique ID for tracing/logging.
   */
  public readonly eventId: string = crypto.randomUUID()

  /**
   * If true, dispatch is deferred until current DB transaction commits.
   *
   * Note: transaction integration is best-effort and framework-dependent.
   */
  public afterCommit = false

  /**
   * Stop propagation to remaining listeners.
   */
  public stopPropagation(): void {
    this.propagationStopped = true
  }
}
