/**
 * Public broadcast channel (maps to a Socket.io room).
 */
export class Channel {
  public constructor(public readonly name: string) {}

  public toString(): string {
    return this.name
  }
}

/**
 * Private channel — requires authentication.
 * Socket.io room prefixed with `private-`.
 */
export class PrivateChannel extends Channel {
  public constructor(name: string) {
    super(`private-${name}`)
  }
}

/**
 * Presence channel — authenticated + exposes member list.
 * Socket.io room prefixed with `presence-`.
 */
export class PresenceChannel extends Channel {
  public constructor(name: string) {
    super(`presence-${name}`)
  }
}
