import 'reflect-metadata'
import http from 'node:http'
import { EventEmitter } from 'node:events'
import { describe, it, expect, vi, afterEach } from 'vitest'

import { Application } from '../src/Application.js'
import { Injectable } from '../src/decorators/Injectable.js'
import { WsServiceProvider } from '../src/websocket/WsServiceProvider.js'
import { WsGateway } from '../src/websocket/WsGateway.js'
import { WsClient } from '../src/websocket/WsClient.js'
import { WsRoom } from '../src/websocket/WsRoom.js'

@Injectable()
class TestGateway extends WsGateway {
  public connected: WsClient[] = []
  public disconnected: WsClient[] = []
  handleConnection(client: WsClient): void {
    this.connected.push(client)
  }
  handleDisconnect(client: WsClient): void {
    this.disconnected.push(client)
  }
}

/** Wait for queueMicrotask + dynamic import('ws') to complete. */
function waitForBoot(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 200))
}

describe('WsServiceProvider — JWT auth rejection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects upgrade when Authorization header is missing', async () => {
    const socketWrite = vi.fn()
    const socketDestroy = vi.fn()

    const mockServer = new EventEmitter()
    const app = new Application()
    app.singleton('server', () => mockServer as unknown as http.Server)

    const provider = new WsServiceProvider({
      gateway: TestGateway,
      verifyToken: vi.fn().mockResolvedValue({ sub: 'u1' }),
    })
    provider.register(app)
    provider.boot(app)

    await waitForBoot()

    const fakeSocket = {
      write: socketWrite,
      destroy: socketDestroy,
    } as unknown as import('node:net').Socket
    mockServer.emit(
      'upgrade',
      { headers: {}, url: '/' } as http.IncomingMessage,
      fakeSocket,
      Buffer.alloc(0),
    )

    await new Promise<void>((resolve) => setTimeout(resolve, 20))

    expect(socketWrite).toHaveBeenCalledWith('HTTP/1.1 401 Unauthorized\r\n\r\n')
    expect(socketDestroy).toHaveBeenCalled()
  })

  it('rejects upgrade when verifyToken throws', async () => {
    const socketWrite = vi.fn()
    const socketDestroy = vi.fn()

    const mockServer = new EventEmitter()
    const app = new Application()
    app.singleton('server', () => mockServer as unknown as http.Server)
    app.singleton('ws.room', () => new WsRoom())

    const provider = new WsServiceProvider({
      gateway: TestGateway,
      verifyToken: vi.fn().mockRejectedValue(new Error('invalid token')),
    })
    provider.register(app)
    provider.boot(app)

    await waitForBoot()

    const fakeSocket = {
      write: socketWrite,
      destroy: socketDestroy,
    } as unknown as import('node:net').Socket
    const fakeRequest = {
      headers: { authorization: 'Bearer bad-token' },
      url: '/',
    } as http.IncomingMessage
    mockServer.emit('upgrade', fakeRequest, fakeSocket, Buffer.alloc(0))

    await new Promise<void>((resolve) => setTimeout(resolve, 20))

    expect(socketWrite).toHaveBeenCalledWith('HTTP/1.1 401 Unauthorized\r\n\r\n')
    expect(socketDestroy).toHaveBeenCalled()
  })

  it('extracts token from ?token= query param when Authorization header is absent', async () => {
    const socketWrite = vi.fn()
    const socketDestroy = vi.fn()
    const verifyToken = vi.fn().mockRejectedValue(new Error('bad'))

    const mockServer = new EventEmitter()
    const app = new Application()
    app.singleton('server', () => mockServer as unknown as http.Server)

    const provider = new WsServiceProvider({ gateway: TestGateway, verifyToken })
    provider.register(app)
    provider.boot(app)

    await waitForBoot()

    const fakeSocket = {
      write: socketWrite,
      destroy: socketDestroy,
    } as unknown as import('node:net').Socket
    const fakeRequest = { headers: {}, url: '/?token=mytoken' } as http.IncomingMessage
    mockServer.emit('upgrade', fakeRequest, fakeSocket, Buffer.alloc(0))

    await new Promise<void>((resolve) => setTimeout(resolve, 20))

    // verifyToken was called with the query param token (even though it threw → 401)
    expect(verifyToken).toHaveBeenCalledWith('mytoken')
    expect(socketDestroy).toHaveBeenCalled()
  })
})
