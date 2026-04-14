import type http from 'node:http'

import type { Application } from '../Application.js'
import { ServiceProvider } from '../ServiceProvider.js'

import { SocketBroadcaster } from './SocketBroadcaster.js'

/**
 * Boots Socket.io and registers `socket.io` + {@link SocketBroadcaster}.
 *
 * Socket.io is lazily imported so @atlex/core can be used without it installed.
 */
export class SocketServiceProvider extends ServiceProvider {
  public register(app: Application): void {
    app.singleton('socket.io', () => {
      throw new Error('socket.io server is not initialized until boot().')
    })

    app.singleton('SocketBroadcaster', () => {
      const io = app.make<import('./SocketBroadcaster.js').SocketLikeServer>('socket.io')
      return new SocketBroadcaster(io)
    })
  }

  public boot(app: Application): void {
    // `http.Server` binding is app-specific. Convention: bind string 'server' to http.Server.
    // Best-effort: start lazily on next tick (allows boot() to stay sync).
    queueMicrotask(() => {
      void (async () => {
        const server = app.make<http.Server>('server')
        const socketIo = await import('socket.io')
        const { Server } = socketIo
        const io = new Server(server, {
          cors: { origin: '*' },
          transports: ['websocket', 'polling'],
          pingTimeout: 20000,
          pingInterval: 25000,
        })
        app.container.instance('socket.io', io)
      })()
    })
  }
}
