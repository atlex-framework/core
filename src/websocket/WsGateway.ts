import type { WsClient } from './WsClient.js'
import type { WsRoom } from './WsRoom.js'

/**
 * Extend this class to implement a WebSocket gateway.
 *
 * @example
 * export class AppWsGateway extends WsGateway {
 *   handleConnection(client: WsClient): void {
 *     client.join(`family:${String(client.meta['familyId'])}`)
 *   }
 *   handleDisconnect(_client: WsClient): void { }
 * }
 *
 * // Broadcast from anywhere in the app:
 * const gw = app.make(AppWsGateway)
 * gw.broadcast('family:abc', 'location:update', { lat: 40.7, lng: -74.0 })
 */
export abstract class WsGateway {
  /** @internal — injected by WsServiceProvider */
  public _room!: WsRoom

  /**
   * Called when a client successfully upgrades and passes JWT auth.
   * Use `client.join(room)` here to subscribe to rooms.
   *
   * @param client - the newly connected client
   */
  public abstract handleConnection(client: WsClient): void

  /**
   * Called when a client socket closes (for any reason).
   * Client is automatically removed from all rooms after this hook.
   *
   * @param client - the disconnecting client
   */
  public abstract handleDisconnect(client: WsClient): void

  /**
   * Broadcast an event to all clients in `room`.
   *
   * @param room    - room name, e.g. `'family:abc'`
   * @param event   - event name, e.g. `'location:update'`
   * @param payload - JSON-serialisable data
   */
  public broadcast(room: string, event: string, payload: unknown): void {
    this._room.broadcast(room, event, payload)
  }
}
