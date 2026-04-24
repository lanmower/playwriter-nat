#!/usr/bin/env node

import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import type { HonoRequest } from 'hono'
import { WebSocket } from 'ws'
import chalk from 'chalk'
import crypto from 'node:crypto'
import { z } from 'zod'

const PORT = parseInt(process.env.PORT || '3000', 10)
const REFLECTOR_HOST = process.env.REFLECTOR_HOST || 'localhost'
const AUTH_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex')

interface ClientConnection {
  id: string
  subdomain: string
  ws: WebSocket
  connectedAt: Date
  lastPing: Date
  authenticated: boolean
}

interface RemoteClient {
  clientId: string
  subdomain: string
  connected: boolean
  connectedAt: Date
}

const ClientConnections = new Map<string, ClientConnection>()
const RemoteClients = new Map<string, RemoteClient>()
const SubdomainToConnection = new Map<string, string>()

const TokenSchema = z.string().min(32, 'Token must be at least 32 characters')
const QuerySchema = z.object({
  token: TokenSchema.optional(),
  subdomain: z.string().optional(),
})

function generateClientId(): string {
  return crypto.randomBytes(16).toString('hex')
}

function validateToken(token: string | undefined, subdomain: string): boolean {
  if (!token) {
    return false
  }

  const expectedToken = crypto
    .createHash('sha256')
    .update(`${subdomain}:${AUTH_SECRET}`)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expectedToken)
  )
}

function getSubdomainFromHost(host: string | undefined): string | null {
  if (!host) return null

  const parts = host.split('.')
  if (parts.length < 2) return null

  const subdomain = parts[0]
  if (subdomain === 'localhost' || subdomain === 'www') return null

  return subdomain
}

function broadcastToClients(subdomain: string, message: any) {
  const connectionId = SubdomainToConnection.get(subdomain)
  if (!connectionId) return

  const connection = ClientConnections.get(connectionId)
  if (connection && connection.ws.readyState === 1) {
    try {
      connection.ws.send(JSON.stringify(message))
    } catch (e) {
      console.error(`Failed to send message to ${subdomain}:`, e)
    }
  }
}

const app = new Hono()

const ws = createNodeWebSocket({ app })

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/status', (c) => {
  return c.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    connectedClients: ClientConnections.size,
    activeSubdomains: Array.from(SubdomainToConnection.keys()),
    remoteClients: Array.from(RemoteClients.values()).map((rc) => ({
      clientId: rc.clientId,
      subdomain: rc.subdomain,
      connectedAt: rc.connectedAt.toISOString(),
    })),
  })
})

app.get('/register', async (c) => {
  const query = QuerySchema.parse(c.req.query())
  const hostHeader = c.req.header('host')
  const subdomain = getSubdomainFromHost(hostHeader)

  if (!subdomain) {
    return c.json(
      { error: 'Invalid subdomain or host header missing' },
      { status: 400 }
    )
  }

  if (!query.token) {
    return c.json(
      {
        error: 'Missing authentication token',
        instructions: 'Include ?token=<your-token> in the query',
      },
      { status: 401 }
    )
  }

  if (!validateToken(query.token, subdomain)) {
    return c.json(
      { error: 'Invalid authentication token' },
      { status: 403 }
    )
  }

  const clientId = generateClientId()
  const remoteClient: RemoteClient = {
    clientId,
    subdomain,
    connected: true,
    connectedAt: new Date(),
  }
  RemoteClients.set(clientId, remoteClient)

  return c.json({
    clientId,
    subdomain,
    reflectorUrl: `ws://${REFLECTOR_HOST}:${PORT}/${subdomain}`,
    timestamp: new Date().toISOString(),
  })
})

app.get('/token', async (c) => {
  const query = z.object({ subdomain: z.string() }).parse(c.req.query())
  const authSecret = process.env.AUTH_SECRET

  if (!authSecret) {
    return c.json(
      { error: 'Server not configured with AUTH_SECRET' },
      { status: 500 }
    )
  }

  const token = crypto
    .createHash('sha256')
    .update(`${query.subdomain}:${authSecret}`)
    .digest('hex')

  return c.json({
    subdomain: query.subdomain,
    token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })
})

app.get('/connect', (c) => {
  const hostHeader = c.req.header('host')
  const subdomain = getSubdomainFromHost(hostHeader)

  if (!subdomain) {
    return c.json({ error: 'Missing or invalid subdomain' }, { status: 400 })
  }

  return c.upgrade((ws: WebSocket) => {
    const clientId = generateClientId()
    const connection: ClientConnection = {
      id: clientId,
      subdomain,
      ws,
      connectedAt: new Date(),
      lastPing: new Date(),
      authenticated: false,
    }

    ClientConnections.set(clientId, connection)
    SubdomainToConnection.set(subdomain, clientId)

    console.log(
      chalk.green(`✓ Client connected: ${clientId} (${subdomain})`)
    )

    ws.on('message', (message: any) => {
      try {
        const data = JSON.parse(message as string)

        if (data.type === 'auth' && data.token) {
          if (validateToken(data.token, subdomain)) {
            connection.authenticated = true
            ws.send(JSON.stringify({ type: 'auth', success: true }))
            console.log(chalk.blue(`✓ Client authenticated: ${subdomain}`))
          } else {
            ws.send(JSON.stringify({ type: 'auth', success: false, error: 'Invalid token' }))
            ws.close()
          }
          return
        }

        if (!connection.authenticated) {
          ws.send(JSON.stringify({ error: 'Not authenticated' }))
          return
        }

        if (data.type === 'ping') {
          connection.lastPing = new Date()
          ws.send(JSON.stringify({ type: 'pong' }))
          return
        }

        connection.lastPing = new Date()

        for (const [, client] of ClientConnections) {
          if (client.id !== clientId && client.subdomain === subdomain && client.authenticated) {
            try {
              client.ws.send(message as string)
            } catch (e) {
              console.error(`Failed to relay message:`, e)
            }
          }
        }
      } catch (e) {
        console.error(`Failed to parse message:`, e)
      }
    })

    ws.on('close', () => {
      ClientConnections.delete(clientId)
      SubdomainToConnection.delete(subdomain)
      RemoteClients.delete(clientId)
      console.log(chalk.yellow(`✗ Client disconnected: ${clientId} (${subdomain})`))
    })

    ws.on('error', (error: any) => {
      console.error(chalk.red(`✗ WebSocket error (${clientId}): ${error.message}`))
    })
  })
})

app.all('*', (c) => {
  return c.json({ error: 'Not found' }, { status: 404 })
})

const server = serve(
  {
    fetch: app.fetch,
    port: PORT,
    hostname: '0.0.0.0',
  },
  (info) => {
    console.log(chalk.cyan('┌─────────────────────────────────────────────────────────────┐'))
    console.log(chalk.cyan('│         Playwriter Reflector Server                          │'))
    console.log(chalk.cyan('├─────────────────────────────────────────────────────────────┤'))
    console.log(chalk.cyan(`│ Host: ${REFLECTOR_HOST.padEnd(54)} │`))
    console.log(chalk.cyan(`│ Port: ${PORT.toString().padEnd(54)} │`))
    console.log(chalk.cyan('│                                                              │'))
    console.log(chalk.cyan('│ Endpoints:                                                   │'))
    console.log(chalk.cyan(`│   Health:  http://localhost:${PORT}/health`.padEnd(63) + '│'))
    console.log(chalk.cyan(`│   Status:  http://localhost:${PORT}/status`.padEnd(63) + '│'))
    console.log(chalk.cyan(`│   Register: http://localhost:${PORT}/register`.padEnd(63) + '│'))
    console.log(chalk.cyan(`│   Token:   http://localhost:${PORT}/token`.padEnd(63) + '│'))
    console.log(chalk.cyan('│                                                              │'))
    console.log(chalk.cyan('│ AUTH_SECRET: ' + (AUTH_SECRET.slice(0, 20) + '...').padEnd(49) + '│'))
    console.log(chalk.cyan('└─────────────────────────────────────────────────────────────┘'))
  }
)

process.on('SIGINT', () => {
  console.log(chalk.yellow('\nShutting down gracefully...'))
  server.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\nShutting down gracefully...'))
  server.close()
  process.exit(0)
})
