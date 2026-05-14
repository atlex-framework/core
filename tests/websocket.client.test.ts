import { describe, it, expect, vi } from 'vitest'
import { WsClient } from '../src/websocket/WsClient.js'
import type { WebSocket } from 'ws'

function makeMockSocket(readyState = 1): WebSocket {
  return { readyState, OPEN: 1, send: vi.fn() } as unknown as ws.WebSocket
}

describe('WsClient', () => {
  it('join adds room to client.rooms', () => {
    const client = new WsClient(makeMockSocket(), {})
    client.join('device:1')
    expect(client.rooms.has('device:1')).toBe(true)
  })

  it('leave removes room from client.rooms', () => {
    const client = new WsClient(makeMockSocket(), {})
    client.join('device:1')
    client.leave('device:1')
    expect(client.rooms.has('device:1')).toBe(false)
  })

  it('send serialises event + payload as JSON', () => {
    const socket = makeMockSocket()
    const client = new WsClient(socket, { sub: 'u1' })
    client.send('location:update', { lat: 40.7 })
    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({ event: 'location:update', payload: { lat: 40.7 } }),
    )
  })

  it('send is a no-op when socket is not OPEN', () => {
    const socket = makeMockSocket(3 /* CLOSED */)
    const client = new WsClient(socket, {})
    client.send('ping', {})
    expect(socket.send).not.toHaveBeenCalled()
  })

  it('meta is populated from constructor argument', () => {
    const client = new WsClient(makeMockSocket(), { sub: 'abc', familyId: 'f1' })
    expect(client.meta['sub']).toBe('abc')
    expect(client.meta['familyId']).toBe('f1')
  })
})
