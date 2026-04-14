import type { Broadcastable } from './Broadcastable.js'
import { type Channel, PresenceChannel, PrivateChannel } from './Channel.js'

export interface SocketLikeServer {
  to(room: string): { emit(eventName: string, payload: unknown): void }
  emit(eventName: string, payload: unknown): void
  except(room: string): { emit(eventName: string, payload: unknown): void }
  use(mw: (socket: unknown, next: (err?: Error) => void) => void): void
}

export type AuthCallback = (socket: unknown, channel: string) => boolean | Promise<boolean>

function dotCaseFromPascal(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1.$2')
    .replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, '$1.$2')
    .toLowerCase()
}

function publicProps(obj: object): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k.startsWith('_')) continue
    out[k] = v
  }
  return out
}

export interface BroadcastTarget {
  emit(eventName: string, payload: unknown): void
}

/**
 * Bridges {@link EventDispatcher} → Socket.io server.
 */
export class SocketBroadcaster {
  private readonly authCallbacks = new Map<string, AuthCallback>()

  public constructor(private readonly io: SocketLikeServer) {}

  /**
   * Broadcast an event.
   */
  public async broadcast(event: Broadcastable & object): Promise<void> {
    const on = event.broadcastOn()
    const channels = Array.isArray(on) ? on : [on]
    const name = event.broadcastAs?.() ?? dotCaseFromPascal(event.constructor.name)
    const payload = event.broadcastWith?.() ?? publicProps(event)

    for (const ch of channels) {
      const room = this.normalizeRoom(ch)
      this.io.to(room).emit(name, payload)
    }
  }

  public broadcastToAll(eventName: string, payload: Record<string, unknown>): void {
    this.io.emit(eventName, payload)
  }

  public broadcastExcept(socketId: string, eventName: string, payload: unknown): void {
    this.io.except(socketId).emit(eventName, payload)
  }

  public toChannel(channel: string): BroadcastTarget {
    return {
      emit: (eventName, payload) => {
        this.io.to(channel).emit(eventName, payload)
      },
    }
  }

  /**
   * Register a channel authorization callback (private/presence).
   */
  public authorize(channelName: string, authCallback: AuthCallback): this {
    this.authCallbacks.set(channelName, authCallback)
    return this
  }

  /**
   * @internal
   */
  public _getAuthCallbacks(): Map<string, AuthCallback> {
    return this.authCallbacks
  }

  private normalizeRoom(channel: Channel): string {
    if (channel instanceof PrivateChannel) return channel.name
    if (channel instanceof PresenceChannel) return channel.name
    return channel.name
  }
}
