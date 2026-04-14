import type { Constructor, Container } from '../Container.js'
import { Injectable } from '../decorators/Injectable.js'

import type { Broadcastable } from './Broadcastable.js'
import type { EventSubscriber } from './EventSubscriber.js'
import { ListenerException } from './exceptions/ListenerException.js'
import { ListenerRegistry } from './Listen.js'
import type { Listener } from './Listener.js'
import {
  _getQueueEventJobsRegistry,
  _requireQueueEventJobsRegistry,
} from './queueEventJobsBridge.js'
import { SHOULD_QUEUE_LISTENER } from './ShouldQueue.js'

export type ListenerFn = (event: object) => Promise<void> | void
type WildcardListenerFn = (eventName: string, event: object) => Promise<void> | void

function isBroadcastable(event: object): event is Broadcastable & object {
  return typeof (event as Partial<Broadcastable>).broadcastOn === 'function'
}

function hasPropagationStopped(event: object): boolean {
  return (
    'propagationStopped' in (event as Record<string, unknown>) &&
    Boolean((event as unknown as { propagationStopped?: unknown }).propagationStopped)
  )
}

function dotCaseFromPascal(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1.$2')
    .replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, '$1.$2')
    .toLowerCase()
}

function matchWildcard(pattern: string, eventName: string): boolean {
  const re = new RegExp(
    '^' +
      pattern
        .split('.')
        .map((seg) => (seg === '*' ? '[^.]+?' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        .join('\\.') +
      '$',
  )
  return re.test(eventName)
}

/**
 * Central event dispatcher.
 */
@Injectable()
export class EventDispatcher {
  private readonly listeners = new Map<Constructor<object>, (Constructor<object> | ListenerFn)[]>()
  private readonly wildcard = new Map<string, WildcardListenerFn[]>()
  private readonly pushed = new Map<Constructor<object>, object[]>()

  private readonly macros = new Map<string, Function>()

  public constructor(private readonly container: Container) {}

  /**
   * Register a listener class or function for an event.
   */
  public listen<TEvent extends object>(
    eventClass: Constructor<TEvent>,
    listener: Constructor<object> | ((event: TEvent) => Promise<void> | void),
  ): this {
    const arr = this.listeners.get(eventClass) ?? []
    arr.push(listener as Constructor<object> | ListenerFn)
    this.listeners.set(eventClass, arr)
    return this
  }

  public listenMany(map: Record<string, Constructor<object>[]>): this {
    for (const [eventName, listeners] of Object.entries(map)) {
      const eventClass = this.resolveEventClass(eventName)
      for (const l of listeners) this.listen(eventClass, l)
    }
    return this
  }

  public subscribe(subscriber: Constructor<object> | EventSubscriber): this {
    const instance =
      typeof subscriber === 'function'
        ? (this.container.make(subscriber) as EventSubscriber)
        : subscriber
    instance.subscribe(this)
    return this
  }

  public forget(eventClass: Constructor<object>): this {
    this.listeners.delete(eventClass)
    return this
  }

  public forgetListener(
    eventClass: Constructor<object>,
    listener: Constructor<object> | ListenerFn,
  ): this {
    const arr = this.listeners.get(eventClass)
    if (!arr) return this
    this.listeners.set(
      eventClass,
      arr.filter((l) => l !== listener),
    )
    return this
  }

  public hasListeners(eventClass: Constructor<object>): boolean {
    return (
      (this.getListeners(eventClass).length ?? 0) > 0 ||
      this.getWildcardListenersFor(eventClass).length > 0
    )
  }

  public getListeners(eventClass: Constructor<object>): (Constructor<object> | ListenerFn)[] {
    const local = this.listeners.get(eventClass) ?? []
    const decorated = ListenerRegistry.getListeners(eventClass)
    return [...local, ...decorated]
  }

  public getRawListeners(): Map<Constructor<object>, (Constructor<object> | ListenerFn)[]> {
    return this.listeners
  }

  /**
   * Register wildcard listener for event name patterns (`user.*`).
   */
  public listenWildcard(pattern: string, listener: WildcardListenerFn): this {
    const arr = this.wildcard.get(pattern) ?? []
    arr.push(listener)
    this.wildcard.set(pattern, arr)
    return this
  }

  /**
   * Dispatch an event.
   */
  public async dispatch(event: object): Promise<void> {
    await this.dispatchInternal(event, { sync: false, until: false })
  }

  /**
   * Dispatch synchronously (inline listeners, immediate broadcasting).
   */
  public dispatchSync(event: object): void {
    void this.dispatchInternal(event, { sync: true, until: false })
  }

  /**
   * Alias for dispatch() that bypasses afterCommit checks (currently no-op).
   */
  public async dispatchNow(event: object): Promise<void> {
    await this.dispatch(event)
  }

  /**
   * Dispatch and halt if any listener returns `false`.
   */
  public async until(event: object): Promise<boolean> {
    return await this.dispatchInternal(event, { sync: false, until: true })
  }

  /**
   * Best-effort defer until after response; falls back to immediate dispatch.
   */
  public dispatchAfterResponse(event: object): void {
    queueMicrotask(() => {
      void this.dispatch(event)
    })
  }

  /**
   * Push events for deferred batch dispatch.
   */
  public push<TEvent extends object>(eventClass: Constructor<TEvent>, payload: unknown[]): this {
    const list = this.pushed.get(eventClass) ?? []
    list.push(new eventClass(...payload))
    this.pushed.set(eventClass, list)
    return this
  }

  public async flush<TEvent extends object>(eventClass: Constructor<TEvent>): Promise<void> {
    const list = this.pushed.get(eventClass) ?? []
    this.pushed.delete(eventClass)
    for (const e of list) await this.dispatch(e)
  }

  public forgetPushed(): this {
    this.pushed.clear()
    return this
  }

  /**
   * Extend dispatcher at runtime.
   */
  public macro(name: string, fn: Function): void {
    this.macros.set(name, fn)
    ;(this as unknown as Record<string, unknown>)[name] = fn.bind(this)
  }

  private resolveEventClass(eventName: string): Constructor<object> {
    // In core, we don't have dynamic class resolution. We treat eventName as a missing type boundary.
    // Callers using listenMany should only use classes in their own provider subclasses.
    throw new Error(
      `EventDispatcher.listenMany cannot resolve event class by name: [${eventName}]. Use listen(EventClass, Listener).`,
    )
  }

  private getWildcardListenersFor(eventClass: Constructor<object>): WildcardListenerFn[] {
    const eventName = dotCaseFromPascal(eventClass.name)
    const out: WildcardListenerFn[] = []
    for (const [pattern, listeners] of this.wildcard.entries()) {
      if (matchWildcard(pattern, eventName)) out.push(...listeners)
    }
    return out
  }

  private async dispatchInternal(
    event: object,
    opts: { sync: boolean; until: boolean },
  ): Promise<boolean> {
    const eventClass = event.constructor as Constructor<object>
    const name = dotCaseFromPascal(eventClass.name)

    // meta-events (non-recursive best-effort)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    Promise.resolve().then(() => {
      // no-op placeholder: app-level listeners can wildcard 'event.*' if desired
    })

    // broadcastNow before listeners
    if (isBroadcastable(event) && event.broadcastNow === true) {
      await this.tryBroadcast(event)
    }

    // wildcard listeners by name
    for (const wl of this.getWildcardListenersFor(eventClass)) {
      const r: unknown = await wl(name, event)
      if (opts.until && r === false) return false
    }

    const listeners = this.getListeners(eventClass)
    for (const l of listeners) {
      const result = await this.invokeListener(l, event, opts.sync)
      if (opts.until && result === false) return false
      if (hasPropagationStopped(event)) break
    }

    // broadcast after listeners
    if (isBroadcastable(event) && event.broadcastNow !== true) {
      if (opts.sync) {
        await this.tryBroadcast(event)
      } else {
        const queueName = event.broadcastQueue ?? 'broadcasting'
        const q = _getQueueEventJobsRegistry()
        if (q !== null) {
          const job = q.createBroadcastEventJob(event)
          job.onQueue(queueName)
          await q.dispatch(job).dispatch()
        } else {
          await this.tryBroadcast(event)
        }
      }
    }

    return true
  }

  private async invokeListener(
    listener: Constructor<object> | ListenerFn,
    event: object,
    sync: boolean,
  ): Promise<unknown> {
    try {
      const listenerProto =
        typeof listener === 'function' && 'prototype' in listener
          ? (listener as { prototype?: { handle?: unknown } }).prototype
          : undefined
      if (listenerProto?.handle !== undefined) {
        // listener class
        const listenerClass = listener as Constructor<object>
        const instance = this.container.make(listenerClass) as Listener<object>
        const shouldQueue =
          (listenerClass as unknown as Record<PropertyKey, unknown>)[SHOULD_QUEUE_LISTENER] === true
        if (shouldQueue && !sync) {
          // If events binding is faked, record queued listener without side effects.
          try {
            const maybeFake = this.container.make<unknown>('events')
            const fakeRecord =
              typeof maybeFake === 'object' && maybeFake !== null
                ? (maybeFake as Record<string, unknown>)
                : null
            if (
              fakeRecord !== null &&
              '_recordQueuedListener' in fakeRecord &&
              typeof fakeRecord['_recordQueuedListener'] === 'function'
            ) {
              ;(fakeRecord['_recordQueuedListener'] as (c: Constructor<object>) => void)(
                listenerClass,
              )
              return
            }
          } catch {
            // ignore
          }
          const q = _requireQueueEventJobsRegistry()
          const job = q.createHandleListenerJob(listenerClass, event).applyListenerOptions()
          await q.dispatch(job).dispatch()
          return
        }
        return await instance.handle(event)
      }

      // function listener
      const fn = listener as ListenerFn
      return await fn(event)
    } catch (cause) {
      throw new ListenerException(
        typeof listener === 'function' && 'name' in listener
          ? (listener as Constructor<object>)
          : (class FnListener {} as unknown as Constructor<object>),
        event,
        cause,
      )
    }
  }

  private async tryBroadcast(event: Broadcastable & object): Promise<void> {
    try {
      const broadcaster =
        this.container.make<import('./SocketBroadcaster.js').SocketBroadcaster>('SocketBroadcaster')
      await broadcaster.broadcast(event)
    } catch {
      // socket broadcasting is optional
    }
  }
}
