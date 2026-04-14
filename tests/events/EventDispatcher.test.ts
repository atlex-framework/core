import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { Container } from '../../src/Container.js'
import { Injectable } from '../../src/decorators/Injectable.js'
import { Singleton } from '../../src/decorators/Singleton.js'
import { Event } from '../../src/events/Event.js'
import { EventDispatcher } from '../../src/events/EventDispatcher.js'
import { Listen } from '../../src/events/Listen.js'
import { SHOULD_QUEUE_LISTENER } from '../../src/events/ShouldQueue.js'
import type { Broadcastable } from '../../src/events/Broadcastable.js'
import { Channel } from '../../src/events/Channel.js'
import {
  _registerQueueEventJobs,
  _resetQueueEventJobsBridgeForTests,
} from '../../src/events/queueEventJobsBridge.js'

beforeEach(() => {
  _registerQueueEventJobs({
    dispatch: (job: unknown) => ({
      dispatch: async () => {
        ;(globalThis as unknown as { __queuedJobs?: unknown[] }).__queuedJobs = [
          ...(((globalThis as unknown as { __queuedJobs?: unknown[] }).__queuedJobs ??
            []) as unknown[]),
          job,
        ]
        return 'uuid'
      },
    }),
    createBroadcastEventJob: (event: Broadcastable & object) => ({
      onQueue(_q: string) {
        return this
      },
      __event: event,
    }),
    createHandleListenerJob: (listenerClass: unknown, event: unknown) => ({
      listenerClass,
      event,
      onQueue(_q: string) {
        return this
      },
      applyListenerOptions() {
        return this
      },
    }),
  })
})

afterEach(() => {
  _resetQueueEventJobsBridgeForTests()
})

class UserRegistered extends Event {
  public constructor(public readonly userId: number) {
    super()
  }
}

@Injectable()
@Singleton()
class FirstListener {
  public calls = 0
  public handle(_event: UserRegistered): void {
    this.calls += 1
  }
}

@Injectable()
class StopperListener {
  public handle(event: UserRegistered): void {
    event.stopPropagation()
  }
}

@Listen(UserRegistered)
@Injectable()
@Singleton()
class DecoratedListener {
  public calls = 0
  public handle(): void {
    this.calls += 1
  }
}

@Injectable()
class QueuedListener {
  public static [SHOULD_QUEUE_LISTENER] = true
  public handle(): void {
    // should not run inline in async dispatch
  }
}

describe('EventDispatcher', () => {
  test('listen + dispatch fires listener handle', async () => {
    const c = new Container()
    const d = new EventDispatcher(c)
    d.listen(UserRegistered, FirstListener)
    await d.dispatch(new UserRegistered(1))
    const resolved = c.make(FirstListener)
    expect(resolved.calls).toBe(1)
  })

  test('multiple listeners fire in order + propagation stops', async () => {
    const c = new Container()
    const d = new EventDispatcher(c)
    const calls: string[] = []
    d.listen(UserRegistered, () => calls.push('a'))
    d.listen(UserRegistered, StopperListener)
    d.listen(UserRegistered, () => calls.push('b'))
    c.instance(StopperListener, new StopperListener())
    await d.dispatch(new UserRegistered(1))
    expect(calls).toEqual(['a'])
  })

  test('until returns false when any listener returns false', async () => {
    const c = new Container()
    const d = new EventDispatcher(c)
    d.listen(UserRegistered, () => false as any)
    const ok = await d.until(new UserRegistered(1))
    expect(ok).toBe(false)
  })

  test('wildcard listener user.* fires', async () => {
    const c = new Container()
    const d = new EventDispatcher(c)
    const calls: string[] = []
    d.listenWildcard('user.*', (name) => calls.push(name))
    await d.dispatch(new UserRegistered(1))
    expect(calls[0]).toBe('user.registered')
  })

  test('push + flush dispatches all pushed events', async () => {
    const c = new Container()
    const d = new EventDispatcher(c)
    const ids: number[] = []
    d.listen(UserRegistered, (e: any) => ids.push(e.userId))
    d.push(UserRegistered, [1]).push(UserRegistered, [2])
    await d.flush(UserRegistered)
    expect(ids).toEqual([1, 2])
  })

  test('@Listen decorated class is auto-registered via ListenerRegistry', async () => {
    const c = new Container()
    const d = new EventDispatcher(c)
    await d.dispatch(new UserRegistered(1))
    const resolved = c.make(DecoratedListener)
    expect(resolved.calls).toBe(1)
  })

  test('ShouldQueue listener dispatches job (handle not called inline)', async () => {
    const c = new Container()
    c.instance(QueuedListener, new QueuedListener())
    const d = new EventDispatcher(c)
    d.listen(UserRegistered, QueuedListener)
    ;(globalThis as any).__queuedJobs = []
    await d.dispatch(new UserRegistered(1))
    expect(((globalThis as any).__queuedJobs as unknown[]).length).toBe(1)
  })

  test('Broadcastable broadcastNow triggers broadcaster immediately', async () => {
    const c = new Container()
    const broadcast = vi.fn(async () => undefined)
    c.instance('SocketBroadcaster', { broadcast })
    const d = new EventDispatcher(c)

    class BroadcastEvt implements Broadcastable {
      public broadcastNow = true
      public constructor(public readonly id: number) {}
      public broadcastOn(): Channel {
        return new Channel('public')
      }
    }

    await d.dispatch(new BroadcastEvt(1) as any)
    expect(broadcast).toHaveBeenCalledTimes(1)
  })
})
