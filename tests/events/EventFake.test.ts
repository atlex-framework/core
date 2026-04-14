import { describe, expect, test, vi } from 'vitest'

import { Container } from '../../src/Container.js'
import { EventDispatcher } from '../../src/events/EventDispatcher.js'
import { EventFake } from '../../src/events/testing/EventFake.js'
import type { Broadcastable } from '../../src/events/Broadcastable.js'
import { Channel } from '../../src/events/Channel.js'

vi.mock('@atlex/queue', () => {
  class Job {
    public constructor(..._args: unknown[]) {}
    protected _app(): null {
      return null
    }
  }
  return {
    Job,
    dispatch: (_job: unknown) => ({
      dispatch: async () => 'uuid',
    }),
  }
})

class UserRegistered {
  public constructor(public readonly userId: number) {}
}

class OrderShipped implements Broadcastable {
  public constructor(public readonly orderId: number) {}
  public broadcastOn(): Channel {
    return new Channel('orders.1')
  }
}

describe('EventFake', () => {
  test('assertDispatched passes when dispatched', async () => {
    const c = new Container()
    c.instance('events', new EventDispatcher(c))
    const fake = EventFake.fake(c)
    await fake.dispatch(new UserRegistered(1))
    expect(() => fake.assertDispatched(UserRegistered)).not.toThrow()
  })

  test('assertDispatchedTimes exact count check', async () => {
    const c = new Container()
    c.instance('events', new EventDispatcher(c))
    const fake = EventFake.fake(c)
    await fake.dispatch(new UserRegistered(1))
    await fake.dispatch(new UserRegistered(2))
    expect(() => fake.assertDispatchedTimes(UserRegistered, 2)).not.toThrow()
  })

  test('assertBroadcastOn works', async () => {
    const c = new Container()
    c.instance('events', new EventDispatcher(c))
    const fake = EventFake.fake(c)
    await fake.dispatch(new OrderShipped(1))
    expect(() => fake.assertBroadcastOn('orders.1', OrderShipped)).not.toThrow()
  })

  test('partial fake: listed events faked, others pass through', async () => {
    const c = new Container()
    const real = new EventDispatcher(c)
    c.instance('events', real)

    const calls: number[] = []
    real.listen(UserRegistered, (e: any) => calls.push(e.userId))

    const fake = EventFake.fake(c, [OrderShipped])
    await fake.dispatch(new UserRegistered(1))
    expect(calls).toEqual([1])
  })
})
