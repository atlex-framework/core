import { AssertionError } from 'node:assert'

import type { Constructor, Container } from '../../Container.js'
import type { Broadcastable } from '../Broadcastable.js'
import type { Channel } from '../Channel.js'
import type { EventDispatcher } from '../EventDispatcher.js'

interface DispatchedRecord {
  event: object
  eventClass: Constructor<object>
}
interface BroadcastRecord {
  event: Broadcastable & object
}
interface QueuedListenerRecord {
  listenerClass: Constructor<object>
}

function nameOf(ctor: Constructor<object>): string {
  return ctor.name || 'Event'
}

function matches<T>(items: T[], predicate: (item: T) => boolean): boolean {
  return items.some(predicate)
}

/**
 * Test double for {@link EventDispatcher}.
 *
 * Captures dispatched events without running listeners or broadcasting.
 */
export class EventFake {
  private dispatchedEvents: DispatchedRecord[] = []
  private broadcastEvents: BroadcastRecord[] = []
  private queuedListeners: QueuedListenerRecord[] = []

  public constructor(
    private readonly dispatcher: EventDispatcher,
    private readonly eventsToFake: Constructor<object>[],
  ) {}

  /**
   * Swap container binding with an {@link EventFake}.
   */
  public static fake(app: Container, events?: Constructor<object>[]): EventFake {
    const real = app.make<EventDispatcher>('events')
    const fake = new EventFake(real, events ?? [])
    app.instance('events', fake as unknown as EventDispatcher)
    return fake
  }

  private shouldFake(event: object): boolean {
    if (this.eventsToFake.length === 0) return true
    return this.eventsToFake.some((ctor) => event instanceof ctor)
  }

  public async dispatch(event: object): Promise<void> {
    if (!this.shouldFake(event)) {
      // passthrough
      await this.dispatcher.dispatch(event)
      return
    }
    this.dispatchedEvents.push({ event, eventClass: event.constructor as Constructor<object> })
    if (typeof (event as Partial<Broadcastable>).broadcastOn === 'function') {
      this.broadcastEvents.push({ event: event as Broadcastable & object })
    }
  }

  public dispatchSync(event: object): void {
    void this.dispatch(event)
  }

  /** Assertions **/
  public assertDispatched(
    eventClass: Constructor<object>,
    callback?: (event: object) => boolean,
  ): void {
    const ok = matches(
      this.dispatchedEvents,
      (r) => r.event instanceof eventClass && (callback ? callback(r.event) : true),
    )
    if (!ok) {
      throw new AssertionError({
        message: `Expected [${nameOf(eventClass)}] to be dispatched, but it was not.`,
      })
    }
  }

  public assertDispatchedTimes(eventClass: Constructor<object>, times: number): void {
    const actual = this.dispatchedEvents.filter((r) => r.event instanceof eventClass).length
    if (actual !== times) {
      throw new AssertionError({
        message: `Expected [${nameOf(eventClass)}] to be dispatched ${times} time(s), but was dispatched ${actual} time(s).`,
      })
    }
  }

  public assertNotDispatched(
    eventClass: Constructor<object>,
    callback?: (event: object) => boolean,
  ): void {
    const ok = !matches(
      this.dispatchedEvents,
      (r) => r.event instanceof eventClass && (callback ? callback(r.event) : true),
    )
    if (!ok) {
      throw new AssertionError({
        message: `Expected [${nameOf(eventClass)}] not to be dispatched, but it was.`,
      })
    }
  }

  public assertNothingDispatched(): void {
    if (this.dispatchedEvents.length > 0) {
      throw new AssertionError({
        message: `Expected no events to be dispatched, but ${this.dispatchedEvents.length} were dispatched.`,
      })
    }
  }

  public assertListenerQueued(listenerClass: Constructor<object>): void {
    const ok = matches(this.queuedListeners, (r) => r.listenerClass === listenerClass)
    if (!ok) {
      throw new AssertionError({
        message: `Expected listener [${listenerClass.name}] to be queued, but it was not.`,
      })
    }
  }

  /**
   * Assert a listener was queued (alias of {@link assertListenerQueued}).
   *
   * @param listenerClass - Listener constructor.
   */
  public assertListening(listenerClass: Constructor<object>): void {
    this.assertListenerQueued(listenerClass)
  }

  public assertListenerNotQueued(listenerClass: Constructor<object>): void {
    const ok = !matches(this.queuedListeners, (r) => r.listenerClass === listenerClass)
    if (!ok) {
      throw new AssertionError({
        message: `Expected listener [${listenerClass.name}] not to be queued, but it was.`,
      })
    }
  }

  public assertBroadcast(
    eventClass: Constructor<object>,
    callback?: (event: Broadcastable) => boolean,
  ): void {
    const ok = matches(this.broadcastEvents, (r) => {
      if (!(r.event instanceof eventClass)) return false
      return callback ? callback(r.event) : true
    })
    if (!ok) {
      throw new AssertionError({
        message: `Expected [${nameOf(eventClass)}] to be broadcast, but it was not.`,
      })
    }
  }

  public assertBroadcastOn(channel: string | Channel, eventClass: Constructor<object>): void {
    const name = typeof channel === 'string' ? channel : channel.toString()
    const ok = matches(this.broadcastEvents, (r) => {
      if (!(r.event instanceof eventClass)) return false
      const on = r.event.broadcastOn()
      const channels = Array.isArray(on) ? on : [on]
      return channels.some((c) => c.toString() === name)
    })
    if (!ok) {
      throw new AssertionError({
        message: `Expected [${nameOf(eventClass)}] to be broadcast on channel '${name}', but it was not.`,
      })
    }
  }

  public assertNothingBroadcast(): void {
    if (this.broadcastEvents.length > 0) {
      throw new AssertionError({
        message: `Expected nothing to be broadcast, but ${this.broadcastEvents.length} events were broadcast.`,
      })
    }
  }

  /** Inspection **/
  public dispatched(eventClass: Constructor<object>): object[] {
    return this.dispatchedEvents.filter((r) => r.event instanceof eventClass).map((r) => r.event)
  }

  public hasDispatched(eventClass: Constructor<object>): boolean {
    return this.dispatchedEvents.some((r) => r.event instanceof eventClass)
  }

  public assertDispatchedWithPayload(
    eventClass: Constructor<object>,
    payload: Partial<object>,
  ): void {
    const ok = matches(this.dispatchedEvents, (r) => {
      if (!(r.event instanceof eventClass)) return false
      for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
        if ((r.event as Record<string, unknown>)[k] !== v) return false
      }
      return true
    })
    if (!ok) {
      throw new AssertionError({
        message: `Expected [${nameOf(eventClass)}] to be dispatched with payload ${JSON.stringify(payload)}, but it was not.`,
      })
    }
  }

  public reset(): void {
    this.dispatchedEvents = []
    this.broadcastEvents = []
    this.queuedListeners = []
  }

  /**
   * @internal Allow tests to record a queued listener.
   */
  public _recordQueuedListener(listenerClass: Constructor<object>): void {
    this.queuedListeners.push({ listenerClass })
  }
}
