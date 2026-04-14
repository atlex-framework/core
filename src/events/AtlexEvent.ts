/**
 * Base class for framework events (auth, mail, etc.).
 */
export abstract class AtlexEvent {
  /**
   * Timestamp when the event instance was created.
   */
  public readonly occurredAt: Date = new Date()
}
