import type { WsClient } from './WsClient.js'

/**
 * Registry that maps room names to the set of clients currently in them.
 * A single WsRoom instance is shared across all WsGateway subclasses
 * registered via the same WsServiceProvider.
 */
export class WsRoom {
  private readonly rooms: Map<string, Set<WsClient>> = new Map()

  /**
   * Add a client to a room.
   *
   * @param client - the client to add
   * @param room   - room name
   */
  public join(client: WsClient, room: string): void {
    if (!this.rooms.has(room)) this.rooms.set(room, new Set())
    this.rooms.get(room)!.add(client)
    client.join(room)
  }

  /**
   * Remove a client from a room.
   *
   * @param client - the client to remove
   * @param room   - room name
   */
  public leave(client: WsClient, room: string): void {
    this.rooms.get(room)?.delete(client)
    client.leave(room)
  }

  /**
   * Remove a client from all rooms. Call on disconnect.
   *
   * @param client - the disconnecting client
   */
  public removeAll(client: WsClient): void {
    for (const room of client.rooms) {
      this.rooms.get(room)?.delete(client)
    }
    client.rooms.clear()
  }

  /**
   * Broadcast a JSON event to all clients in a room.
   * Skips clients whose socket is not in OPEN state.
   *
   * @param room    - room name
   * @param event   - event name
   * @param payload - JSON-serialisable data
   */
  public broadcast(room: string, event: string, payload: unknown): void {
    const clients = this.rooms.get(room)
    if (!clients) return
    const message = JSON.stringify({ event, payload })
    for (const client of clients) {
      if (client.socket.readyState === client.socket.OPEN) {
        client.socket.send(message)
      }
    }
  }

  /**
   * Returns the number of connected clients in a room.
   *
   * @param room - room name
   * @returns client count
   */
  public size(room: string): number {
    return this.rooms.get(room)?.size ?? 0
  }
}
