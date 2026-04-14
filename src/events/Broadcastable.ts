import type { Channel } from './Channel.js'

/**
 * Events implementing this interface can be broadcast over Socket.io.
 */
export interface Broadcastable {
  /**
   * Return channel(s) to broadcast on.
   */
  broadcastOn(): Channel | Channel[]

  /**
   * The event name clients will receive.
   */
  broadcastAs?(): string

  /**
   * The payload sent to clients.
   */
  broadcastWith?(): Record<string, unknown>

  /**
   * If true, broadcast is sent before listeners run.
   */
  broadcastNow?: boolean

  /**
   * Optional queue name for deferred broadcasting.
   */
  broadcastQueue?: string
}
