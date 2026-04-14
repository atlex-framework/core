import { describe, expect, test } from 'vitest'

import { Listen, ListenerRegistry } from '../../src/events/Listen.js'

class UserRegistered {}

@Listen(UserRegistered)
class SendWelcomeEmail {}

describe('@Listen decorator', () => {
  test('registers decorated class in ListenerRegistry', () => {
    const listeners = ListenerRegistry.getListeners(UserRegistered)
    expect(listeners).toContain(SendWelcomeEmail)
  })

  test('supports multiple events array', () => {
    class UserDeleted {}
    @Listen([UserRegistered, UserDeleted])
    class MultiListener {}

    expect(ListenerRegistry.getListeners(UserRegistered)).toContain(MultiListener)
    expect(ListenerRegistry.getListeners(UserDeleted)).toContain(MultiListener)
  })
})
