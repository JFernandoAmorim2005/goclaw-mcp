# Phase 2 — GoClaw API Client

**Priority:** Critical
**Status:** Pending
**Effort:** M (Medium)

## Overview

Type-safe HTTP client wrapping GoClaw Gateway's REST API. Thin adapter — no business logic, just typed request/response with error handling.

## Key Insights

- GoClaw API uses JSON envelope: `{ "ok": bool, "payload": data, "error": {...} }`
- Auth: `Authorization: Bearer <token>` + `X-GoClaw-User-Id` header
- 30s timeout, retry on 429/5xx with exponential backoff
- All CRUD follows REST conventions: GET list, POST create, PUT update, DELETE remove

## Requirements

### Functional
- Typed methods for all GoClaw API endpoints used by MCP tools
- Automatic retry with exponential backoff (429, 5xx)
- Request/response logging (no secrets)
- Configurable base URL, token, user ID

### Non-Functional
- Zero external HTTP dependencies (use Node.js built-in `fetch`)
- <100ms overhead per request
- Circuit breaker for cascading failure prevention

## Architecture

```
src/client/
├── index.ts              # GoClawClient class (main export)
├── types.ts              # API request/response types
├── http.ts               # Low-level HTTP helper (fetch wrapper)
└── endpoints/
    ├── agents.ts         # Agent CRUD + context files + links
    ├── sessions.ts       # Session list/preview/delete/reset
    ├── config.ts         # Config get/apply/patch
    ├── providers.ts      # LLM provider CRUD
    ├── mcp-servers.ts    # MCP server CRUD + grants
    ├── skills.ts         # Skills list/get/update + grants
    ├── custom-tools.ts   # Custom tool CRUD + invoke
    ├── cron.ts           # Cron job CRUD + toggle/run
    ├── teams.ts          # Team CRUD + members + tasks
    ├── traces.ts         # Trace list/detail
    ├── channels.ts       # Channel list/toggle
    ├── memory.ts         # Memory documents CRUD
    └── system.ts         # Health, status, models list
```

## Related Code Files

### Create
- `src/client/index.ts` — Main client class, endpoint aggregation
- `src/client/types.ts` — All API types (request/response/envelope)
- `src/client/http.ts` — Fetch wrapper with retry, timeout, error mapping
- `src/client/endpoints/*.ts` — Per-domain endpoint methods

## Implementation Steps

1. Define types in `src/client/types.ts`:
   - `ApiResponse<T>` envelope: `{ ok: boolean, payload: T, error?: ApiError }`
   - `ApiError`: `{ code: string, message: string, status_code: number }`
   - Entity types: `Agent`, `Session`, `McpServer`, `Provider`, `Skill`, `CustomTool`, `CronJob`, `Team`, `Trace`, `Channel`, `MemoryDocument`
   - Keep types minimal — only fields MCP tools actually use

2. Create `src/client/http.ts`:
   - `HttpClient` class with `baseUrl`, `token`, `userId`
   - Methods: `get<T>()`, `post<T>()`, `put<T>()`, `delete<T>()`
   - Auto-add `Authorization` and `X-GoClaw-User-Id` headers
   - 30s timeout via `AbortController`
   - Retry logic: max 3 retries, exponential backoff (200ms base), jitter, only on 429/5xx
   - Parse response envelope, throw `GoClawError` on `ok: false`
   - Log request method/path/status (no body, no auth headers)

3. Create endpoint modules (each exports a mixin function):
   ```typescript
   // Example: src/client/endpoints/agents.ts
   export function agentEndpoints(http: HttpClient) {
     return {
       listAgents: () => http.get<Agent[]>('/v1/agents'),
       getAgent: (id: string) => http.get<Agent>(`/v1/agents/${id}`),
       createAgent: (data: CreateAgentRequest) => http.post<Agent>('/v1/agents', data),
       updateAgent: (id: string, data: UpdateAgentRequest) => http.put<Agent>(`/v1/agents/${id}`, data),
       deleteAgent: (id: string) => http.delete(`/v1/agents/${id}`),
       // context files, links, shares...
     };
   }
   ```

4. Create `src/client/index.ts`:
   - `GoClawClient` class composing all endpoint mixins
   - Constructor takes `{ baseUrl, token?, userId? }` from config
   - Single `HttpClient` instance shared across endpoints
   - `health()` method for connection verification

5. Add circuit breaker to `HttpClient`:
   - 5 consecutive failures → open circuit (30s cooldown)
   - Half-open: allow 1 request to test recovery
   - Log state transitions

## Endpoint Coverage

| Domain | Endpoints | Priority |
|--------|-----------|----------|
| System | health, status, models.list | P0 |
| Agents | list, get, create, update, delete, files, links, shares | P0 |
| Sessions | list, preview, delete, reset, label | P0 |
| Config | get, apply, patch, schema | P0 |
| Providers | list, get, create, update, delete | P1 |
| MCP Servers | list, get, create, update, delete, grants | P1 |
| Skills | list, get, update, grants | P1 |
| Custom Tools | list, get, create, update, delete, invoke | P1 |
| Cron | list, create, update, delete, toggle, run | P1 |
| Teams | list, get, create, update, delete, members, tasks | P2 |
| Traces | list, detail | P2 |
| Channels | list, toggle | P2 |
| Memory | list, get, create, delete | P2 |

## Todo

- [ ] Define API types
- [ ] HTTP client with retry + circuit breaker
- [ ] System endpoints (health, status, models)
- [ ] Agent endpoints
- [ ] Session endpoints
- [ ] Config endpoints
- [ ] Provider endpoints
- [ ] MCP server endpoints
- [ ] Skill endpoints
- [ ] Custom tool endpoints
- [ ] Cron endpoints
- [ ] Team endpoints
- [ ] Trace endpoints
- [ ] Channel endpoints
- [ ] Memory endpoints
- [ ] GoClawClient aggregation class

## Success Criteria

- All endpoint methods are typed with request/response types
- Retry logic works (test with mock 429 responses)
- Circuit breaker opens after 5 failures, recovers after cooldown
- No secrets in logs
- `client.health()` succeeds against running GoClaw instance

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GoClaw API changes | Low | Med | Type-safe client catches at compile time |
| Missing endpoint docs | Med | Low | Reference goclaw-cli source as ground truth |

## Next Steps

→ Phase 3: Core MCP Tools
