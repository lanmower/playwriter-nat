# Playwriter Reflector

A remote reflector server for [Playwriter](https://github.com/remorses/playwriter) that enables subdomain-based routing and authentication for secure remote connections. Perfect for deployment on Coolify or any cloud infrastructure.

## Features

- **Subdomain Routing**: Each Playwriter instance gets its own subdomain (e.g., `client1.reflector.example.com`)
- **Token Authentication**: Secure token-based auth for all connections
- **Auto Token Generation**: Generate tokens on-the-fly without secrets
- **WebSocket Relay**: Transparent relay between Playwriter clients and the reflector
- **Health Checks**: Built-in health check endpoints for orchestration
- **Docker Ready**: Includes Dockerfile and docker-compose for easy deployment
- **Coolify Compatible**: Deploy directly to Coolify with environment variables

## Architecture

```
┌─────────────────────────────────────────────────────┐
│         Your Local/Remote Playwriter                │
│  npx playwriter --host reflector.example.com         │
│              --token <secret>                        │
└────────────────┬──────────────────────────────────────┘
                 │ WebSocket
                 ▼
┌─────────────────────────────────────────────────────┐
│    Playwriter Reflector (Coolify Container)          │
│  - Validates token for subdomain                     │
│  - Routes messages between clients                   │
│  - Maintains connection state                        │
└─────────────────────────────────────────────────────┘
                 │ HTTP/WebSocket
                 ▼
┌─────────────────────────────────────────────────────┐
│        Claude Code / Browser Extensions              │
│   Connects via subdomain: client1.example.com        │
└─────────────────────────────────────────────────────┘
```

## Installation

### From Source

```bash
cd reflector
npm install
npm run build
npm start
```

### Docker

```bash
docker build -t playwriter-reflector .
docker run -p 3000:3000 \
  -e AUTH_SECRET="your-secret-key" \
  -e REFLECTOR_HOST="reflector.example.com" \
  playwriter-reflector
```

### Docker Compose

```bash
docker-compose up -d
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `REFLECTOR_HOST` | `localhost` | Public reflector hostname (for display) |
| `AUTH_SECRET` | `random` | Secret key for token generation (REQUIRED for production) |

### Coolify Deployment

1. Create a new application in Coolify
2. Set the Docker image to `playwriter-reflector:latest` (or build from source)
3. Set environment variables:
   ```
   PORT=3000
   AUTH_SECRET=<generate-a-secure-random-string>
   REFLECTOR_HOST=<your-coolify-domain>
   ```
4. Configure a custom domain with wildcard subdomain support: `*.reflector.example.com`
5. Deploy

## API Endpoints

### Health Check
```bash
GET /health
```
Returns `{ "status": "ok", "timestamp": "..." }`

### Server Status
```bash
GET /status
```
Returns connected clients, active subdomains, and uptime.

### Register Client
```bash
GET /register?token=<token>&subdomain=<subdomain>
```
Authenticates a new client and returns connection details.

### Generate Token
```bash
GET /token?subdomain=<subdomain>
```
Generates a valid token for a subdomain (requires `AUTH_SECRET` env var).

## Usage

### Step 1: Generate a Token

```bash
curl "http://reflector.example.com/token?subdomain=myapp"
```

Response:
```json
{
  "subdomain": "myapp",
  "token": "a1b2c3d4e5f6...",
  "expiresAt": "2025-01-11T13:00:00.000Z"
}
```

### Step 2: Connect Playwriter

```bash
npx playwriter@latest \
  --host myapp.reflector.example.com \
  --token "a1b2c3d4e5f6..."
```

This starts the Playwriter MCP server that routes through the reflector.

### Step 3: Use in Claude Code

Configure Claude Code to use the remote Playwriter:

```json
{
  "mcpServers": {
    "playwriter": {
      "command": "npx",
      "args": [
        "playwriter@latest",
        "--host",
        "myapp.reflector.example.com",
        "--token",
        "<your-token>"
      ]
    }
  }
}
```

## Architecture Details

### Subdomain Detection

The reflector extracts the subdomain from the `Host` header:
- `myapp.reflector.example.com` → subdomain: `myapp`
- `localhost:3000` → no subdomain (rejected)

### Token Validation

Tokens are generated using HMAC-SHA256:
```
token = HMAC-SHA256(subdomain:AUTH_SECRET)
```

Each subdomain has a unique token that's validated before allowing connections.

### WebSocket Connection Flow

1. Client connects to `ws://reflector.example.com/<subdomain>`
2. Client sends `{ "type": "auth", "token": "..." }`
3. Server validates token and marks connection as authenticated
4. Client can now send/receive messages via the relay

### Message Types

**Authentication**
```json
{ "type": "auth", "token": "..." }
```

**Ping/Pong** (keep-alive)
```json
{ "type": "ping" }
{ "type": "pong" }
```

**Generic Messages**
```json
{ "method": "CDP.Method", "params": {...}, "id": 123 }
```

Messages are relayed transparently between clients on the same subdomain.

## Scaling

### Multiple Subdomains

Each subdomain is isolated:
- `app1.reflector.example.com` → separate connection pool
- `app2.reflector.example.com` → separate connection pool

Scale horizontally by running multiple reflector instances behind a load balancer with sticky sessions.

### Production Considerations

1. **Use HTTPS**: Update connection URLs to `wss://` (requires reverse proxy with SSL)
2. **Rate Limiting**: Add reverse proxy rate limiting per subdomain
3. **Monitoring**: Check `/status` endpoint regularly
4. **Auto-Scaling**: Monitor connection count and scale replicas in Coolify
5. **Cleanup**: Implement connection timeout (currently no idle cleanup)

## Security

- **Token-based auth** protects against unauthorized access
- **Timing-safe comparison** prevents timing attacks
- **Subdomain isolation** prevents cross-talk between subdomains
- **No logs** of message content (only connection/disconnection events)

### Recommendations

1. Use strong, random `AUTH_SECRET` (32+ characters)
2. Rotate secrets periodically
3. Use HTTPS/WSS in production
4. Monitor for suspicious patterns in `/status` endpoint
5. Implement rate limiting at the reverse proxy level

## Troubleshooting

### Token Validation Fails
```
error: Invalid authentication token
```
Ensure:
- Token was generated with the correct subdomain
- `AUTH_SECRET` matches between server and client
- Token hasn't expired (regenerate if needed)

### Connection Refused
```
WebSocket connection to 'ws://...' failed
```
Check:
- Subdomain is in the Host header
- Server is running and `/health` returns 200
- Firewall allows connections
- WebSocket protocol is supported

### Multiple Clients on Same Subdomain
The reflector supports multiple connections to the same subdomain. Messages from one client are relayed to others on the same subdomain.

## Development

### Build
```bash
npm run build
```

### Watch Mode
```bash
npm run watch
```

### Local Testing
```bash
npm run dev
```

Then in another terminal:
```bash
curl http://localhost:3000/health
curl "http://localhost:3000/token?subdomain=test"
```

## License

MIT

## See Also

- [Playwriter](https://github.com/remorses/playwriter) - Browser automation and MCP server
- [Coolify](https://coolify.io) - Self-hosted PaaS
- [Model Context Protocol](https://modelcontextprotocol.io) - Claude integration standard
