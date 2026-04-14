/**
 * Base error for event system failures.
 */
export class EventException extends Error {
  public constructor(
    message: string,
    public override readonly cause?: unknown,
    public readonly event?: object,
  ) {
    super(message)
    this.name = 'EventException'
  }
}
