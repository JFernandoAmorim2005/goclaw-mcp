# GoClaw MCP Server — Product Development Requirements

## Project Overview

**GoClaw MCP** is a Model Context Protocol (MCP) server that wraps the GoClaw Gateway REST API, enabling AI assistants (Claude, Cursor, other MCP clients) to programmatically manage GoClaw infrastructure.

The server bridges two worlds:
- **AI assistants** (MCP clients) speaking the standard MCP protocol
- **GoClaw Gateway** REST API providing agent, session, provider, and gateway management

By implementing MCP, this server makes GoClaw a first-class integration for AI-native workflows — no custom plugins, just standard MCP.

### Problem Statement

GoClaw Gateway operators currently:
- Manage agents, sessions, and configuration via CLI/API directly
- Cannot leverage AI assistants for infrastructure automation
- Must build custom integrations to enable AI-assisted management

### Solution

Deploy GoClaw MCP as:
- **Local mode** (stdio): Direct integration with Claude Code, Cursor
- **Production mode** (HTTP): Multi-client, multi-session infrastructure

### Target Users

1. **AI engineers** using Claude Code / Cursor for agent setup and tuning
2. **GoClaw operators** automating infrastructure via AI assistants
3. **DevOps teams** integrating GoClaw into AI-driven pipelines

---

## Core Requirements

### Functional Requirements

| Req ID | Feature | Priority | Status |
|--------|---------|----------|--------|
| FR-01 | Register 66+ MCP tools across 13 domains | Critical | Complete |
| FR-02 | Type-safe tool parameters via Zod schemas | Critical | Complete |
| FR-03 | Dual transport: stdio + Streamable HTTP | Critical | Complete |
| FR-04 | Resource URLs: status, models, agents, config | High | Complete |
| FR-05 | Reusable prompts for common workflows | High | Complete |
| FR-06 | Session management with rate limiting | High | Complete |
| FR-07 | Audit logging of all tool invocations | High | Complete |
| FR-08 | Secret scrubbing in logs | High | Complete |

### Non-Functional Requirements

| Req ID | Requirement | Target | Status |
|--------|-------------|--------|--------|
| NFR-01 | Type safety | Full TypeScript strict mode | Complete |
| NFR-02 | Error handling | Circuit breaker + retry logic | Complete |
| NFR-03 | Security | Auth passthrough, origin validation | Complete |
| NFR-04 | Performance | Sub-second request latency | Complete |
| NFR-05 | Reliability | Graceful degradation, timeout handling | Complete |
| NFR-06 | Compliance | Structured audit logging (JSON) | Complete |

---

## Technical Specifications

### Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Runtime** | Node.js | 20.0.0+ | ESM modules, native fetch |
| **Language** | TypeScript | 5.9.3+ | Strict mode, decorators |
| **MCP SDK** | @modelcontextprotocol/sdk | 1.27.1+ | Official protocol |
| **Validation** | Zod | 4.3.6+ | Schema-first validation |
| **Build** | tsup | 8.5.1+ | ESM bundling |
| **Testing** | vitest | 4.1.0+ | Vitest runner |
| **Package Manager** | pnpm | Latest | Fast, deterministic |

### Architecture Layers

```
┌─────────────────────────────────────────┐
│  MCP Transports                         │
│  ├── stdio (local dev/integration)     │
│  └── Streamable HTTP (production)      │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  MCP Server Factory                     │
│  ├── Tool registration (13 domains)    │
│  ├── Resource registration (4 URIs)    │
│  └── Prompt registration (4 templates) │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  GoClaw Client                          │
│  ├── HTTP client with retry/circuit     │
│  └── 13 endpoint modules (domain APIs)  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  GoClaw Gateway REST API                │
└─────────────────────────────────────────┘
```

### Tool Domains (66 tools)

1. **System** (3): health, status, models
2. **Agents** (13): CRUD, files, delegation, sharing
3. **Sessions** (5): list, preview, delete, reset, label
4. **Config** (3): get, apply, patch
5. **Providers** (5): CRUD for LLM providers
6. **MCP Servers** (7): CRUD, grant agent/user access
7. **Skills** (5): list, get, update, grant access
8. **Custom Tools** (6): CRUD, invoke
9. **Cron Jobs** (6): CRUD, toggle, run
10. **Teams** (5): CRUD
11. **Traces** (2): list, get with spans
12. **Channels** (2): list, toggle
13. **Memory** (4): CRUD documents

### Configuration

**Required:**
- `GOCLAW_SERVER`: Gateway URL

**Optional:**
- `GOCLAW_TOKEN`: Bearer auth token (RBAC role determined by token)
- `GOCLAW_USER_ID`: Default user for multi-tenant scoping
- `GOCLAW_MCP_PORT`: HTTP port (default: 3100)
- `GOCLAW_MCP_ALLOWED_ORIGINS`: CORS origins (default: localhost)
- `GOCLAW_MCP_RATE_LIMIT_RPM`: Rate limit (default: 60 req/min)
- `GOCLAW_LOG_LEVEL`: Log level (default: info)

---

## Security Architecture

### Authentication & Authorization

- **Bearer token passthrough** — Client token forwarded to GoClaw
- **RBAC enforcement** — Gateway determines allowed operations
- **User scoping** — Optional user context header for multi-tenant isolation

### Data Protection

| Concern | Solution |
|---------|----------|
| Secret leakage in logs | Scrub `token`, `password`, `secret`, `api_key`, `content`, `config` |
| XSS from injected content | JSON escaping + MCP protocol text/markdown types |
| Denial of service | Token bucket rate limiting per session, 1MB request size cap |
| DNS rebinding | Origin validation against allowed list |
| Request timeout | 30s timeout, circuit breaker on repeated failures |

### Audit Trail

- **Structured logging**: All tool invocations logged as JSON
- **Entry fields**: tool, params (scrubbed), sessionId, userId, durationMs, success, error
- **Log levels**: debug, info, warn, error
- **Integration**: Suitable for SIEM export and compliance audits

---

## Deployment Architecture

### Deployment Modes

#### Mode 1: stdio (Local/Direct Integration)

```bash
npx goclaw-mcp
```

**Use cases:**
- Claude Code integration via `~/.claude.json`
- Cursor integration via `.cursor/mcp.json`
- Local development workflows

**Config via env vars only.**

#### Mode 2: Streamable HTTP (Production/Multi-Client)

```bash
GOCLAW_MCP_PORT=3100 npx goclaw-mcp-http
```

**Features:**
- Multiple concurrent clients per server
- Session management with unique session IDs
- Rate limiting per session
- Health check endpoint: `/health`
- MCP endpoint: `/mcp` (POST new, POST existing sessionId, DELETE to close)

**Production considerations:**
- Reverse proxy (nginx) with TLS
- Session sticky routing if load balanced
- Monitoring on `/health` endpoint

### Containerization

Example Dockerfile:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm i -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3100
ENV GOCLAW_MCP_PORT=3100
CMD ["node", "dist/http.js"]
```

---

## Success Criteria

### Development Complete
- [ ] 66 tools registered and callable
- [ ] All tools return well-formatted MCP responses
- [ ] Error handling doesn't crash server
- [ ] Zod validation rejects bad input
- [ ] Tests cover happy path + error cases

### Integration Complete
- [ ] Claude Code can discover and call tools
- [ ] Cursor integration works
- [ ] Type hints display parameter schemas
- [ ] Resources are readable as text/json
- [ ] Prompts execute without error

### Production Ready
- [ ] Rate limiting prevents abuse
- [ ] Circuit breaker protects against cascade failures
- [ ] Audit logs are structured and exportable
- [ ] Secrets never appear in logs
- [ ] Server recovers from transport errors gracefully
- [ ] Documentation is complete and accurate

---

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Tool call latency (p50) | < 500ms | TBD |
| Tool call latency (p99) | < 2s | TBD |
| Memory usage (idle) | < 50MB | TBD |
| Memory usage (100 concurrent) | < 200MB | TBD |
| Throughput (HTTP) | > 100 req/s | TBD |

---

## Maintenance & Support

### Version Strategy

- **Semantic versioning** (MAJOR.MINOR.PATCH)
- **MCP SDK pinned** to tested versions
- **Node.js minimum** tracked against LTS

### Deprecation Policy

- **Tool removal**: 2 release major versions notice
- **Breaking changes**: Major version bump
- **Config changes**: Documented with migration guide

### Known Limitations

- **Circuit breaker scope**: Global per client instance
- **Session persistence**: In-memory only (restart loses sessions)
- **Rate limiting**: Per-session, not per-user
- **No built-in auth**: Relies on GOCLAW_TOKEN bearer header

---

## Documentation & Runbooks

All documentation stored in `./docs/`:
- `project-overview-pdr.md` — This file (strategy, requirements, success criteria)
- `system-architecture.md` — Component diagrams, data flows, module organization
- `code-standards.md` — Coding conventions, patterns, style
- `codebase-summary.md` — File structure, module descriptions, API overview
- `deployment-guide.md` — Setup, configuration, deployment steps

---

## Approval & Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | — | — | — |
| Engineering Lead | — | — | — |
| Security Lead | — | — | — |

---

**Version:** 1.0.0
**Last Updated:** 2026-03-15
**Status:** APPROVED
