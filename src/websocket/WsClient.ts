import type { WebSocket } from 'ws'

/**
 * Metadata decoded from the JWT on the HTTP upgrade request.
 * Consumers augment this via declaration merging:
 *
 * @example
 * declare module '@atlex/core' {
 *   interface WsClientMeta {
 *     userId: string
 *     familyId: string
 *   }
 * }
 */
export interface WsClientMeta {
  sub?: string
  [key: string]: unknown
}

/**
 * Typed wrapper around a raw ws.WebSocket connection.
 */
export class WsClient {
  /** Rooms this client is currently joined to. */
  public readonly rooms: Set<string> = new Set()

  /** JWT claims decoded at upgrade time. */
  public readonly meta: WsClientMeta

  public constructor(
    public readonly socket: WebSocket,
    meta: WsClientMeta,
  ) {
    this.meta = meta
  }

  /**
   * Join a room. Idempotent.
   *
   * @param room - room name, e.g. `'family:abc'`
   */
  public join(room: string): void {
    this.rooms.add(room)
  }

  /**
   * Leave a room. No-op if not joined.
   *
   * @param room - room name to leave
   */
  public leave(room: string): void {
    this.rooms.delete(room)
  }

  /**
   * Send a typed event to this specific client.
   * No-op if socket is not in OPEN state.
   *
   * @param event   - event name
   * @param payload - JSON-serialisable data
   */
  public send(event: string, payload: unknown): void {
    if (this.socket.readyState !== this.socket.OPEN) return
    this.socket.send(JSON.stringify({ event, payload }))
  }
}
