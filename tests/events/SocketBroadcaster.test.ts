import { describe, expect, test, vi } from 'vitest'

import { Channel, PresenceChannel, PrivateChannel } from '../../src/events/Channel.js'
import { SocketBroadcaster } from '../../src/events/SocketBroadcaster.js'

describe('SocketBroadcaster', () => {
  test('broadcast emits to public channel', async () => {
    const emit = vi.fn()
    const io = {
      to: (_room: string) => ({ emit }),
      emit: vi.fn(),
      except: (_room: string) => ({ emit: vi.fn() }),
      use: vi.fn(),
    }
    const b = new SocketBroadcaster(io)

    class OrderShipped {
      public constructor(public readonly orderId: number) {}
      public broadcastOn(): Channel {
        return new Channel('orders.1')
      }
    }

    await b.broadcast(new OrderShipped(1) as any)
    expect(emit).toHaveBeenCalledTimes(1)
  })

  test('private/presence channels use prefixed room names', async () => {
    const toCalls: string[] = []
    const io = {
      to: (room: string) => {
        toCalls.push(room)
        return { emit: vi.fn() }
      },
      emit: vi.fn(),
      except: (_room: string) => ({ emit: vi.fn() }),
      use: vi.fn(),
    }
    const b = new SocketBroadcaster(io)

    class Evt {
      broadcastOn(): Channel[] {
        return [new PrivateChannel('orders.1'), new PresenceChannel('orders.1')]
      }
      broadcastAs(): string {
        return 'order.shipped'
      }
      broadcastWith(): Record<string, unknown> {
        return { ok: true }
      }
    }

    await b.broadcast(new Evt() as any)
    expect(toCalls).toEqual(['private-orders.1', 'presence-orders.1'])
  })
})
