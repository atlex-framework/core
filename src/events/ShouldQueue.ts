/**
 * Marker interface. When a listener implements this, the dispatcher
 * can push it onto the queue instead of running it inline.
 */
export interface ShouldQueue {
  /** Queue name to dispatch on. Defaults to 'default'. */
  queue?: string
  /** Connection name. Defaults to 'default'. */
  connection?: string
  /** Number of retry attempts before marking failed. */
  tries?: number
  /** Backoff in seconds between retries. */
  backoff?: number[]
  /** Called when all retries are exhausted. */
  failed?(event: unknown, error: Error): void
  /** Return false to abort dispatching this listener. */
  shouldDispatch?(event: unknown): boolean
}

/**
 * Runtime marker to indicate a listener should be queued.
 *
 * Because TypeScript interfaces do not exist at runtime, listeners must opt-in by
 * setting a static property:
 *
 * ```ts
 * export class MyListener implements ShouldQueue {
 *   static [SHOULD_QUEUE_LISTENER] = true
 * }
 * ```
 */
export const SHOULD_QUEUE_LISTENER: unique symbol = Symbol.for('atlex:events:shouldQueueListener')
