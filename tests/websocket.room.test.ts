import { describe, it, expect, vi } from 'vitest'
import { WsRoom } from '../src/websocket/WsRoom.js'
import { WsClient } from '../src/websocket/WsClient.js'
import type { WebSocket } from 'ws'

function makeMockSocket(readyState = 1 /* OPEN */): WebSocket {
  return {
    readyState,
    OPEN: 1,
    send: vi.fn(),
  } as unknown as ws.WebSocket
}

describe('WsRoom', () => {
  it('join adds client to room and updates client.rooms', () => {
    const room = new WsRoom()
    const client = new WsClient(makeMockSocket(), { sub: 'u1' })
    room.join(client, 'family:abc')
    expect(client.rooms.has('family:abc')).toBe(true)
    expect(room.size('family:abc')).toBe(1)
  })

  it('leave removes client from room', () => {
    const room = new WsRoom()
    const client = new WsClient(makeMockSocket(), {})
    room.join(client, 'family:abc')
    room.leave(client, 'family:abc')
    expect(client.rooms.has('family:abc')).toBe(false)
    expect(room.size('family:abc')).toBe(0)
  })

  it('removeAll clears client from every room', () => {
    const room = new WsRoom()
    const client = new WsClient(makeMockSocket(), {})
    room.join(client, 'r1')
    room.join(client, 'r2')
    room.removeAll(client)
    expect(client.rooms.size).toBe(0)
    expect(room.size('r1')).toBe(0)
    expect(room.size('r2')).toBe(0)
  })

  it('broadcast sends JSON message to OPEN clients in room', () => {
    const room = new WsRoom()
    const socket = makeMockSocket()
    const client = new WsClient(socket, {})
    room.join(client, 'r1')
    room.broadcast('r1', 'location:update', { lat: 1.0 })
    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({ event: 'location:update', payload: { lat: 1.0 } }),
    )
  })

  it('broadcast skips closed sockets', () => {
    const room = new WsRoom()
    const socket = makeMockSocket(3 /* CLOSED */)
    const client = new WsClient(socket, {})
    room.join(client, 'r1')
    room.broadcast('r1', 'ping', {})
    expect(socket.send).not.toHaveBeenCalled()
  })

  it('broadcast to unknown room is a no-op', () => {
    const room = new WsRoom()
    expect(() => room.broadcast('no-such-room', 'x', {})).not.toThrow()
  })
})
