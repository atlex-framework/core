import { describe, expect, test } from 'vitest'

import { Channel, PresenceChannel, PrivateChannel } from '../../src/events/Channel.js'

describe('Channel', () => {
  test('Channel.toString returns raw name', () => {
    expect(new Channel('orders.1').toString()).toBe('orders.1')
  })

  test('PrivateChannel prefixes with private-', () => {
    expect(new PrivateChannel('orders.1').toString()).toBe('private-orders.1')
  })

  test('PresenceChannel prefixes with presence-', () => {
    expect(new PresenceChannel('orders.1').toString()).toBe('presence-orders.1')
  })
})
