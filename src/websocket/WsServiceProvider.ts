import type http from 'node:http'
import { URL } from 'node:url'

import type { Application } from '../Application.js'
import { ServiceProvider } from '../ServiceProvider.js'

import { WsClient, type WsClientMeta } from './WsClient.js'
import type { WsGateway } from './WsGateway.js'
import { WsRoom } from './WsRoom.js'

export interface WsServiceProviderOptions {
  /**
   * The WsGateway subclass to instantiate and wire up.
   * Must be resolvable from `app.make(gateway)`.
   */
  gateway: new (...args: never[]) => WsGateway

  /**
   * Async function that validates a token string and returns decoded claims.
   * Throw any error to reject the upgrade with HTTP 401.
   *
   * @example
   * verifyToken: (token) => app.make(JwtProvider).verify(token)
   */
  verifyToken: (token: string) => Promise<WsClientMeta>
}

/**
 * Registers the WebSocket server on the Node.js HTTP `upgrade` event.
 * JWT auth is performed before the ws handshake — invalid tokens close
 * the socket with status 401.
 *
 * Register before calling `app.listen()`:
 * @example
 * app.register(new WsServiceProvider({
 *   gateway: AppWsGateway,
 *   verifyToken: (t) => app.make(JwtProvider).verify(t),
 * }))
 */
export class WsServiceProvider extends ServiceProvider {
  public constructor(private readonly options: WsServiceProviderOptions) {
    super()
  }

  /** @param app - application instance */
  public register(app: Application): void {
    app.singleton('ws.room', () => new WsRoom())
  }

  /** @param app - application instance */
  public boot(app: Application): void {
    queueMicrotask(() => {
      void (async () => {
        const { WebSocketServer } = await import('ws')

        const server = app.make<http.Server>('server')
        const room = app.make<WsRoom>('ws.room')

        const gateway = app.make<WsGateway>(this.options.gateway)
        gateway._room = room

        const wss = new WebSocketServer({ noServer: true })

        server.on('upgrade', (request, socket, head) => {
          void (async () => {
            const token = extractToken(request)

            if (token === null) {
              socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
              socket.destroy()
              return
            }

            let meta: WsClientMeta
            try {
              meta = await this.options.verifyToken(token)
            } catch {
              socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
              socket.destroy()
              return
            }

            wss.handleUpgrade(request, socket, head, (ws) => {
              const client = new WsClient(ws, meta)
              gateway.handleConnection(client)

              ws.on('close', () => {
                gateway.handleDisconnect(client)
                room.removeAll(client)
              })
            })
          })()
        })
      })()
    })
  }
}

/**
 * Extract Bearer token from Authorization header or `?token=` query param.
 *
 * @param request - incoming HTTP request
 * @returns token string or null if not found
 */
function extractToken(request: http.IncomingMessage): string | null {
  const authHeader = request.headers['authorization']
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  const rawUrl = request.url ?? ''
  try {
    const url = new URL(rawUrl, 'http://localhost')
    const q = url.searchParams.get('token')
    if (q !== null && q.length > 0) return q
  } catch {
    // malformed URL — fall through
  }
  return null
}
