import type { Constructor } from '../Container.js'

import type { Broadcastable } from './Broadcastable.js'

/**
 * Fluent job reference produced when integrating with `@atlex/queue` jobs.
 */
export type QueueJobRef = {
  onQueue(queue: string): QueueJobRef
  onConnection?(connection: string): QueueJobRef
}

/**
 * Queued listener job reference (supports listener metadata options).
 */
export type QueuedListenerJobRef = QueueJobRef & {
  applyListenerOptions(): QueuedListenerJobRef
}

/**
 * Pending dispatch chain returned by the queue package `dispatch()` helper.
 */
export type QueueDispatchChain = {
  dispatch(): Promise<string>
}

/**
 * Implementations registered by `@atlex/queue` so core can enqueue without importing that package.
 */
export type QueueEventJobsRegistry = {
  dispatch: (job: QueueJobRef) => QueueDispatchChain
  createBroadcastEventJob: (event: Broadcastable & object) => QueueJobRef
  createHandleListenerJob: (
    listenerClass: Constructor<object>,
    event: object,
  ) => QueuedListenerJobRef
}

let registry: QueueEventJobsRegistry | null = null

/**
 * Registers queue-backed job factories and `dispatch` so {@link EventDispatcher} can enqueue
 * without importing `@atlex/queue` (breaks the core ↔ queue package cycle).
 *
 * Called automatically when `@atlex/queue` is imported.
 *
 * @internal
 */
export function _registerQueueEventJobs(next: QueueEventJobsRegistry): void {
  registry = next
}

/**
 * @internal
 */
export function _getQueueEventJobsRegistry(): QueueEventJobsRegistry | null {
  return registry
}

/**
 * @internal
 */
export function _requireQueueEventJobsRegistry(): QueueEventJobsRegistry {
  if (registry === null) {
    throw new Error(
      'Queue integration is not loaded. Import @atlex/queue (or register jobs) before dispatching queued listeners.',
    )
  }
  return registry
}

/**
 * @internal Test hook to clear bridge state between Vitest cases.
 */
export function _resetQueueEventJobsBridgeForTests(): void {
  registry = null
}
