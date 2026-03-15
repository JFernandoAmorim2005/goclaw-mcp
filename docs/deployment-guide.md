# GoClaw MCP Server — Deployment Guide

This guide covers installation, configuration, and deployment of GoClaw MCP in various environments.

---

## Quick Start

### Local Development (stdio)

**Prerequisite:** Node.js 20.0.0+, GoClaw Gateway running at `http://localhost:8080`

```bash
# Clone or download project
cd goclaw-mcp

# Install dependencies
pnpm install

# Start in development mode (watch)
pnpm dev

# In another terminal, run stdio server
GOCLAW_SERVER=http://localhost:8080 pnpm start
```

**In Claude Code:**

Edit `~/.claude.json`:
```json
{
  "mcpServers": {
    "goclaw": {
      "command": "pnpm",
      "args": ["start"],
      "cwd": "/path/to/goclaw-mcp",
      "env": {
        "GOCLAW_SERVER": "http://localhost:8080",
        "GOCLAW_TOKEN": "your-admin-token"
      }
    }
  }
}
```

**In Cursor:**

Edit `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "goclaw": {
      "command": "pnpm",
      "args": ["start"],
      "cwd": "/path/to/goclaw-mcp",
      "env": {
        "GOCLAW_SERVER": "http://localhost:8080",
        "GOCLAW_TOKEN": "your-admin-token"
      }
    }
  }
}
```

---

## Installation

### From npm

```bash
# Global install (recommended)
npm install -g goclaw-mcp

# Or use npx
npx goclaw-mcp          # stdio mode
npx goclaw-mcp-http    # HTTP mode
```

### From Source

```bash
# Clone repository
git clone https://github.com/nextlevelbuilder/goclaw-mcp.git
cd goclaw-mcp

# Install dependencies
pnpm install

# Build
pnpm build

# Run
node dist/index.js           # stdio
GOCLAW_MCP_PORT=3100 node dist/http.js  # HTTP
```

### Docker

**Dockerfile example:**

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm build

# HTTP transport on port 3100
EXPOSE 3100

# Environment defaults (override at runtime)
ENV GOCLAW_MCP_PORT=3100
ENV GOCLAW_LOG_LEVEL=info

# Start HTTP server
CMD ["node", "dist/http.js"]
```

**Build & run:**

```bash
# Build image
docker build -t goclaw-mcp:latest .

# Run container
docker run -it \
  -e GOCLAW_SERVER=http://goclaw-gateway:8080 \
  -e GOCLAW_TOKEN=admin-token \
  -p 3100:3100 \
  goclaw-mcp:latest
```

**Docker Compose example:**

```yaml
version: '3.8'

services:
  goclaw-mcp:
    build: .
    ports:
      - "3100:3100"
    environment:
      GOCLAW_SERVER: http://goclaw-gateway:8080
      GOCLAW_TOKEN: ${GOCLAW_TOKEN}
      GOCLAW_MCP_PORT: 3100
      GOCLAW_LOG_LEVEL: info
    depends_on:
      - goclaw-gateway
    restart: unless-stopped

  goclaw-gateway:
    image: goclaw/gateway:latest
    ports:
      - "8080:8080"
    # ... GoClaw configuration
```

---

## Configuration

### Environment Variables

Create `.env` file (copy from `.env.example`):

```bash
# === REQUIRED ===
# GoClaw gateway server URL
GOCLAW_SERVER=http://localhost:8080

# === OPTIONAL ===
# Bearer token for authentication (determines RBAC role)
GOCLAW_TOKEN=sk-...

# Default user ID for multi-tenant scoping
GOCLAW_USER_ID=user-123

# === HTTP TRANSPORT ONLY ===
# Port for HTTP server (default: 3100)
GOCLAW_MCP_PORT=3100

# Comma-separated allowed origins (default: localhost,127.0.0.1,::1)
GOCLAW_MCP_ALLOWED_ORIGINS=localhost,127.0.0.1,example.com

# Rate limit: requests per minute per session (default: 60)
GOCLAW_MCP_RATE_LIMIT_RPM=60

# === LOGGING ===
# Log level: debug, info, warn, error (default: info)
GOCLAW_LOG_LEVEL=info
```

### Configuration Reference

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `GOCLAW_SERVER` | Yes | — | Gateway URL (e.g., `http://localhost:8080`) |
| `GOCLAW_TOKEN` | No | — | Bearer token (optional, determined by RBAC) |
| `GOCLAW_USER_ID` | No | — | User context (for multi-tenant scoping) |
| `GOCLAW_MCP_PORT` | No | 3100 | HTTP server port (1-65535) |
| `GOCLAW_MCP_ALLOWED_ORIGINS` | No | `localhost,127.0.0.1,::1` | CORS origins (comma-separated) |
| `GOCLAW_MCP_RATE_LIMIT_RPM` | No | 60 | Requests/min per session |
| `GOCLAW_LOG_LEVEL` | No | info | debug, info, warn, error |

**Validation:**
- `GOCLAW_SERVER` must be a valid URL
- `GOCLAW_MCP_PORT` must be integer 1-65535
- `GOCLAW_LOG_LEVEL` must be one of enum values
- Invalid config → startup error with helpful message

---

## Deployment Modes

### Mode 1: stdio (Local Integration)

**Best for:** Claude Code, Cursor, direct client integration

**Entry point:** `dist/index.js` or `npx goclaw-mcp`

**Transport:** stdin/stdout (pipes)

**Sessions:** Single client per process

**Configuration:**
```bash
GOCLAW_SERVER=http://localhost:8080 npx goclaw-mcp
```

**Integration example (Claude Code):**
```json
{
  "mcpServers": {
    "goclaw": {
      "command": "npx",
      "args": ["goclaw-mcp"],
      "env": {
        "GOCLAW_SERVER": "http://localhost:8080",
        "GOCLAW_TOKEN": "your-token"
      }
    }
  }
}
```

**Features:**
- Zero network overhead (local pipes)
- Simple setup (just env vars)
- Single connection per client
- Suitable for development

### Mode 2: Streamable HTTP (Production)

**Best for:** Production, multi-client, reverse proxy setup

**Entry point:** `dist/http.js` or `npx goclaw-mcp-http`

**Transport:** JSON-RPC over HTTP/1.1

**Sessions:** Multiple concurrent clients (unlimited)

**Configuration:**
```bash
GOCLAW_MCP_PORT=3100 npx goclaw-mcp-http
```

**Endpoints:**

| Method | Path | Headers | Purpose |
|--------|------|---------|---------|
| POST | /mcp | (none) | Create new session (returns session ID) |
| POST | /mcp | `mcp-session-id: <id>` | Send request to existing session |
| DELETE | /mcp | `mcp-session-id: <id>` | Terminate session |
| GET | /health | (none) | Health check |

**Health check:**
```bash
curl http://localhost:3100/health
# Response: { "status": "ok", "version": "1.0.0" }
```

**Session workflow:**

```bash
# 1. Create session
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}'

# Response includes session ID in headers

# 2. Use session
curl -X POST http://localhost:3100/mcp \
  -H "mcp-session-id: <id>" \
  -H "Content-Type: application/json" \
  -d '{...}'

# 3. Close session
curl -X DELETE http://localhost:3100/mcp \
  -H "mcp-session-id: <id>"
```

**Features:**
- Multi-client support
- Per-session rate limiting
- Origin validation (CORS)
- Request size limit (1MB)
- Automatic cleanup
- Graceful shutdown

---

## Production Deployment

### Architecture

```
┌─────────────────────────┐
│   MCP Clients           │
│ (Claude Code, Cursor)   │
└────────────┬────────────┘
             │ HTTPS
┌────────────▼────────────┐
│  Reverse Proxy          │
│  (nginx, Caddy)         │
│  ├── TLS termination    │
│  ├── Load balancing     │
│  └── Rate limiting      │
└────────────┬────────────┘
             │ HTTP
┌────────────▼────────────────────────┐
│ GoClaw MCP Instances (1+)           │
│ ├── Instance 1 (port 3100)         │
│ ├── Instance 2 (port 3101)         │
│ └── Instance N (port 310X)         │
│                                     │
│ Sessions in-memory (sticky routing) │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────┐
│  GoClaw Gateway API     │
│  (http://goclaw:8080)   │
└─────────────────────────┘
```

### Nginx Configuration

```nginx
upstream goclaw_mcp {
    # Sticky sessions (session affinity)
    # Each client sticks to one backend
    server localhost:3100;
    server localhost:3101;
    server localhost:3102;
}

server {
    listen 443 ssl http2;
    server_name mcp.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Health check
    location /health {
        proxy_pass http://goclaw_mcp;
        access_log off;
    }

    # MCP endpoint
    location /mcp {
        proxy_pass http://goclaw_mcp;

        # Preserve headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts (allow long requests)
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # Buffering
        proxy_buffering off;
        proxy_request_buffering off;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name mcp.example.com;
    return 301 https://$server_name$request_uri;
}
```

### Systemd Service

**File:** `/etc/systemd/system/goclaw-mcp.service`

```ini
[Unit]
Description=GoClaw MCP Server
After=network.target

[Service]
Type=simple
User=goclaw-mcp
WorkingDirectory=/opt/goclaw-mcp
ExecStart=/usr/bin/node /opt/goclaw-mcp/dist/http.js

# Environment
Environment="GOCLAW_SERVER=http://goclaw-gateway:8080"
Environment="GOCLAW_TOKEN=sk-admin-token"
Environment="GOCLAW_MCP_PORT=3100"
Environment="GOCLAW_LOG_LEVEL=info"

# Auto-restart
Restart=on-failure
RestartSec=10

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=goclaw-mcp

[Install]
WantedBy=multi-user.target
```

**Manage service:**

```bash
# Enable on startup
sudo systemctl enable goclaw-mcp

# Start service
sudo systemctl start goclaw-mcp

# Check status
sudo systemctl status goclaw-mcp

# View logs
journalctl -u goclaw-mcp -f
```

### Kubernetes Deployment

**deployment.yaml:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: goclaw-mcp
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: goclaw-mcp
  template:
    metadata:
      labels:
        app: goclaw-mcp
    spec:
      containers:
      - name: goclaw-mcp
        image: goclaw-mcp:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3100
          name: mcp
        env:
        - name: GOCLAW_SERVER
          value: http://goclaw-gateway:8080
        - name: GOCLAW_TOKEN
          valueFrom:
            secretKeyRef:
              name: goclaw-secrets
              key: token
        - name: GOCLAW_MCP_PORT
          value: "3100"
        - name: GOCLAW_LOG_LEVEL
          value: info
        livenessProbe:
          httpGet:
            path: /health
            port: 3100
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 3100
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          requests:
            memory: "64Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: goclaw-mcp
spec:
  selector:
    app: goclaw-mcp
  ports:
  - port: 3100
    targetPort: mcp
  type: LoadBalancer
```

**Deploy:**

```bash
# Create secret
kubectl create secret generic goclaw-secrets \
  --from-literal=token=sk-admin-token

# Deploy
kubectl apply -f deployment.yaml

# Check status
kubectl get pods -l app=goclaw-mcp
kubectl logs -l app=goclaw-mcp -f
```

---

## Monitoring & Observability

### Health Checks

**Endpoint:** `GET /health`

```bash
curl http://localhost:3100/health
# Response: { "status": "ok", "version": "1.0.0" }
```

**Use for:**
- Load balancer health probe
- Container liveness check
- Uptime monitoring

### Logging

**Format:** Structured JSON

```json
{
  "level": "info",
  "message": "Tool: goclaw_agent_list",
  "timestamp": "2026-03-15T12:00:00.000Z",
  "event": "tool_invoked",
  "tool": "goclaw_agent_list",
  "params": { "filter": "active" },
  "sessionId": "abc-123",
  "userId": "user-456",
  "durationMs": 125,
  "result": "success"
}
```

**Log levels:**
- `debug` — Verbose request/response details
- `info` — Tool invocations, session lifecycle
- `warn` — Rate limits, circuit breaker state
- `error` — Failures, exceptions

**Set level:**
```bash
GOCLAW_LOG_LEVEL=debug node dist/http.js
```

### Log Export (SIEM)

**JSON output is SIEM-compatible:**

```bash
# Send to Splunk
docker run -e GOCLAW_LOG_LEVEL=info \
  goclaw-mcp:latest | \
  curl -X POST https://splunk.example.com/collector \
    -H "Authorization: Bearer $SPLUNK_TOKEN" \
    -d @-

# Send to ELK stack
node dist/http.js 2>&1 | \
  jq -Rc '{message: .} | @json' | \
  curl -X POST http://elasticsearch:9200/_bulk -d @-
```

### Metrics

**Key metrics to track:**

| Metric | How to Measure | Target |
|--------|----------------|--------|
| Error rate | Count errors in logs | < 1% |
| Latency (p50) | Audit log durationMs | < 200ms |
| Latency (p99) | Audit log durationMs | < 2000ms |
| Rate limit hits | Count 429 responses | < 5% of requests |
| Circuit breaker trips | Count "open" state logs | 0 in stable deployment |
| Memory usage | RSS from `top`/Prometheus | < 100MB |
| Concurrent sessions | Unique sessionIds in logs | N/A (monitor growth) |

**Prometheus exporter (example):**

```javascript
// Minimal Prometheus metrics
const metrics = {
  toolInvocations: new Counter({
    name: 'goclaw_tool_invocations_total',
    help: 'Total tool invocations',
    labelNames: ['tool', 'status'],
  }),
  toolDuration: new Histogram({
    name: 'goclaw_tool_duration_seconds',
    help: 'Tool invocation duration',
    labelNames: ['tool'],
  }),
  rateLimitHits: new Counter({
    name: 'goclaw_rate_limit_hits_total',
    help: 'Rate limit rejections',
  }),
};

// Endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

---

## Troubleshooting

### Server Won't Start

**Problem:** "GOCLAW_SERVER environment variable is required"

**Solution:** Set `GOCLAW_SERVER` environment variable
```bash
export GOCLAW_SERVER=http://localhost:8080
node dist/http.js
```

**Problem:** "GOCLAW_MCP_PORT must be 1-65535"

**Solution:** Use valid port number
```bash
GOCLAW_MCP_PORT=3100 node dist/http.js
```

### High Latency

**Symptoms:** Tools taking >1 second to complete

**Diagnosis:**
1. Check GoClaw gateway health: `GOCLAW_LOG_LEVEL=debug`
2. Enable debug logging to see retry attempts
3. Check network latency to gateway: `ping goclaw-gateway`
4. Review circuit breaker state in logs

**Solutions:**
- Increase `REQUEST_TIMEOUT_MS` (edit `http-client.ts`)
- Increase `GOCLAW_MCP_RATE_LIMIT_RPM` if rate limited
- Add memory to server if memory-constrained

### Rate Limiting Issues

**Symptoms:** Clients getting 429 Too Many Requests

**Diagnosis:**
1. Check configured limit: `GOCLAW_MCP_RATE_LIMIT_RPM`
2. Count requests per minute from audit logs
3. Check if single session is exceeding quota

**Solutions:**
- Increase `GOCLAW_MCP_RATE_LIMIT_RPM` if limits are too strict
- Implement client-side request batching
- Use multiple client sessions to distribute load

### Connection Refused

**Symptoms:** "Cannot connect to GOCLAW_SERVER"

**Diagnosis:**
1. Verify GoClaw gateway is running: `curl http://goclaw:8080/health`
2. Check firewall rules
3. Check DNS resolution: `ping goclaw-gateway`

**Solutions:**
- Start GoClaw gateway: `docker run -p 8080:8080 goclaw/gateway`
- Update firewall to allow port 8080
- Use IP address instead of hostname if DNS issue

### Memory Leak

**Symptoms:** Memory usage steadily increasing over time

**Diagnosis:**
1. Monitor memory: `watch -n 1 'ps aux | grep node'`
2. Enable garbage collection logs
3. Check for large session accumulation

**Solutions:**
- Restart server (sessions are ephemeral)
- Check rate limiter cleanup (runs every 5 min)
- Check for resource leaks in audit logging

---

## Security Hardening

### Network Security

```nginx
# Rate limit requests
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req zone=api burst=20;

# Request size limit
client_max_body_size 1m;

# Timeouts
client_body_timeout 30s;
client_header_timeout 30s;

# CORS headers
add_header 'Access-Control-Allow-Origin' '$allowed_origins' always;
add_header 'Access-Control-Allow-Methods' 'POST, DELETE, OPTIONS' always;
```

### Secret Management

**Never commit secrets:**
```bash
# DO NOT commit .env with tokens
echo ".env" >> .gitignore

# Use env vars or secret manager
export GOCLAW_TOKEN=$(aws secretsmanager get-secret-value \
  --secret-id goclaw/token --query SecretString --output text)
```

**Token rotation:**
```bash
# Rotate token in production
GOCLAW_TOKEN=new-token systemctl restart goclaw-mcp

# Old sessions continue with old token (per-session storage)
# New sessions use new token
```

### Audit Logging

**Enable structured logging:**
```bash
# Default logs to stdout (JSON)
GOCLAW_LOG_LEVEL=info node dist/http.js > logs/app.log 2>&1

# Export to SIEM
cat logs/app.log | \
  jq 'select(.event=="tool_invoked") | {tool, user: .userId, result, time: .timestamp}' | \
  curl -X POST http://siem:5000/logs -d @-
```

---

## Scaling

### Vertical Scaling

**Single instance:**
- Memory: 64MB idle, ~50KB per concurrent session
- Typical: 2 cores, 1GB memory
- Max connections: Limited by OS file descriptors

**Increase capacity:**
```bash
# Increase max file descriptors
ulimit -n 65536

# Run with more memory
NODE_OPTIONS="--max-old-space-size=2048" node dist/http.js
```

### Horizontal Scaling

**Multiple instances behind load balancer:**

1. **Session affinity required** (sticky routing)
   - Current: Sessions in-memory per instance
   - Solution: Use `Cookie` or IP-hash for sticky sessions

2. **Rate limiter scope** (per-session, not global)
   - Current: Each instance has its own rate limiter
   - Solution: Use Redis for shared state (future enhancement)

**nginx sticky routing:**

```nginx
upstream goclaw_mcp {
    hash $cookie_jsessionid consistent;
    server instance1:3100;
    server instance2:3100;
    server instance3:3100;
}

location /mcp {
    proxy_pass http://goclaw_mcp;
    proxy_cookie_path / "/";
    proxy_cookie_flags ~ secure httponly samesite=strict;
}
```

---

## Backup & Recovery

### Configuration Backup

```bash
# Backup .env (careful: contains secrets!)
gpg --encrypt --recipient admin@example.com .env
cp .env.gpg backup/

# Or use secret manager
aws secretsmanager create-secret \
  --name goclaw-mcp/config \
  --secret-string file://.env
```

### Log Rotation

```bash
# logrotate config
/var/log/goclaw-mcp.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 goclaw-mcp goclaw-mcp
    sharedscripts
}
```

---

## Upgrading

### Zero-Downtime Upgrade

**With load balancer:**

```bash
# 1. Build new version
pnpm build

# 2. Start new instance on different port
GOCLAW_MCP_PORT=3101 node dist/http.js &

# 3. Wait for health check to pass
curl http://localhost:3101/health

# 4. Remove old instance from load balancer
# nginx: Comment out old upstream server

# 5. Monitor logs
tail -f /var/log/goclaw-mcp.log

# 6. Once stable, shutdown old instance
kill <old-pid>

# 7. Update load balancer to point to new instance
# nginx: Uncomment new upstream server
```

**With systemd:**

```bash
# 1. Backup current version
cp -r /opt/goclaw-mcp /opt/goclaw-mcp.backup

# 2. Deploy new version
npm install -g goclaw-mcp@latest

# 3. Restart service (brief downtime)
sudo systemctl restart goclaw-mcp

# 4. Verify health
curl http://localhost:3100/health

# 5. Check logs
journalctl -u goclaw-mcp -f
```

---

## Performance Tuning

### Connection Pooling

HTTP client uses Node.js native fetch (connection pooling via HTTP agent):

```javascript
// Max sockets per host
const agent = new http.Agent({ maxSockets: 100 });
const httpsAgent = new https.Agent({ maxSockets: 100 });

// Reuse in fetch
fetch(url, { agent: isHttps ? httpsAgent : agent });
```

### Request Batching

Group multiple tool calls to reduce roundtrips:

```typescript
// Instead of:
const a1 = await client.agents.getAgent("a1");
const a2 = await client.agents.getAgent("a2");

// Use:
const [a1, a2] = await Promise.all([
  client.agents.getAgent("a1"),
  client.agents.getAgent("a2"),
]);
```

### Caching

Consider caching frequently accessed data (future enhancement):

```typescript
// Example: Cache agent list (TTL 60s)
const agentCache = new Map<string, { data: Agent[], expires: number }>();

async function listAgentsWithCache(): Promise<Agent[]> {
  const cached = agentCache.get("all");
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  const data = await client.agents.listAgents();
  agentCache.set("all", { data, expires: Date.now() + 60000 });
  return data;
}
```

---

## Checklist

### Pre-Production

- [ ] GoClaw Gateway running and accessible
- [ ] GOCLAW_SERVER and GOCLAW_TOKEN set
- [ ] TLS certificates ready (for HTTPS)
- [ ] Reverse proxy (nginx/Caddy) configured
- [ ] Systemd service or Docker container prepared
- [ ] Monitoring and alerting set up
- [ ] Log rotation configured
- [ ] Secret management in place
- [ ] Backup strategy defined
- [ ] Upgrade plan documented

### Post-Deployment

- [ ] Health check endpoint responding
- [ ] Logs being produced and archived
- [ ] Metrics being collected
- [ ] SIEM integration tested
- [ ] Load balancer health probes passing
- [ ] Rate limiting verified
- [ ] Error handling tested (gateway down scenario)
- [ ] Audit logs exportable
- [ ] Documentation updated with deployment details
- [ ] Runbooks created for common issues

---

**Last Updated:** 2026-03-15
**Version:** 1.0
