# GoClaw MCP Server — System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Clients                              │
│  ┌──────────┐  ┌────────┐  ┌─────────┐  ┌──────────────┐  │
│  │Claude    │  │ Cursor │  │ Custom  │  │ Other MCP    │  │
│  │ Code     │  │        │  │ Clients │  │ Clients      │  │
│  └──────────┘  └────────┘  └─────────┘  └──────────────┘  │
└──────┬──────────────────────┬─────────────────────┬─────────┘
       │                      │                     │
       │ stdio               │ HTTP                 │
       │ (stdio transport)   │ (Streamable HTTP)    │
       │                      │                     │
┌──────▼──────────────────────▼─────────────────────▼─────────┐
│                    GoClaw MCP Server                         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ MCP Server Factory (server.ts)                         │ │
│  │ ├── createServer(config) → McpServer                  │ │
│  │ ├── Registers all tools, resources, prompts           │ │
│  │ └── Creates GoClaw client instance                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─── Tool Registration (tools/) ──────────────────────────┐ │
│  │ 13 domain registrars, each adds ~5 tools              │ │
│  │ ├── register-system-tools.ts (3 tools)                │ │
│  │ ├── register-agent-tools.ts (13 tools)               │ │
│  │ ├── register-session-tools.ts (5 tools)              │ │
│  │ ├── register-config-tools.ts (3 tools)               │ │
│  │ ├── register-provider-tools.ts (5 tools)             │ │
│  │ ├── register-mcp-server-tools.ts (7 tools)           │ │
│  │ ├── register-skill-tools.ts (5 tools)                │ │
│  │ ├── register-custom-tool-tools.ts (6 tools)          │ │
│  │ ├── register-cron-tools.ts (6 tools)                 │ │
│  │ ├── register-team-tools.ts (5 tools)                 │ │
│  │ ├── register-trace-tools.ts (2 tools)                │ │
│  │ ├── register-channel-tools.ts (2 tools)              │ │
│  │ └── register-memory-tools.ts (4 tools)               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─── Resource & Prompt Registration ──────────────────────┐ │
│  │ resources/index.ts                                      │ │
│  │ ├── goclaw://status (gateway status)                  │ │
│  │ ├── goclaw://models (available LLM models)            │ │
│  │ ├── goclaw://agents (all agents list)                 │ │
│  │ └── goclaw://config (current config JSON)             │ │
│  │                                                         │ │
│  │ prompts/index.ts                                        │ │
│  │ ├── goclaw_setup_agent (agent creation workflow)      │ │
│  │ ├── goclaw_troubleshoot (systematic troubleshooting)  │ │
│  │ ├── goclaw_review_config (config review)              │ │
│  │ └── goclaw_optimize_agent (optimization suggestions)  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─── Supporting Infrastructure ──────────────────────────┐ │
│  │ lib/logger.ts → Structured JSON logging               │ │
│  │ lib/audit.ts → Tool invocation audit trails           │ │
│  │ lib/rate-limiter.ts → Token bucket per session        │ │
│  │ lib/errors.ts → Unified error handling                │ │
│  │ config.ts → Environment-based configuration           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─── GoClaw Client (client/) ────────────────────────────┐ │
│  │ goclaw-client.ts → Aggregates endpoints               │ │
│  │ http-client.ts → Low-level HTTP with:                 │ │
│  │   • Bearer auth headers                               │ │
│  │   • Exponential backoff retry (MAX_RETRIES=3)        │ │
│  │   • Circuit breaker (5 failures → open state)         │ │
│  │   • 30s request timeout                               │ │
│  │   • Automatic error mapping (4xx, 5xx)               │ │
│  │                                                         │ │
│  │ endpoints/ (13 modules)                                │ │
│  │ ├── system-endpoints.ts (health, status, models)      │ │
│  │ ├── agent-endpoints.ts (agent CRUD + files)           │ │
│  │ ├── session-endpoints.ts (session management)         │ │
│  │ ├── config-endpoints.ts (gateway config)              │ │
│  │ ├── provider-endpoints.ts (LLM providers)             │ │
│  │ ├── mcp-server-endpoints.ts (MCP servers)             │ │
│  │ ├── skill-endpoints.ts (GoClaw skills)                │ │
│  │ ├── custom-tool-endpoints.ts (custom tools)           │ │
│  │ ├── cron-endpoints.ts (scheduled jobs)                │ │
│  │ ├── team-endpoints.ts (team management)               │ │
│  │ ├── trace-endpoints.ts (LLM traces)                   │ │
│  │ ├── channel-endpoints.ts (messaging channels)         │ │
│  │ └── memory-endpoints.ts (memory documents)            │ │
│  │                                                         │ │
│  │ types.ts → Shared type definitions                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─── Entry Points ───────────────────────────────────────┐ │
│  │ index.ts → stdio transport (local dev)               │ │
│  │ http.ts → Streamable HTTP transport (production)      │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                           │
                           │ REST API calls
                           │
┌──────────────────────────▼──────────────────────────────────┐
│             GoClaw Gateway API                              │
│             (External Service)                              │
│                                                              │
│  Endpoints for:                                            │
│  • System health & status                                  │
│  • Agent management (CRUD, files, delegation)             │
│  • Session management                                      │
│  • Configuration & providers                              │
│  • MCP servers & skills                                    │
│  • Custom tools & cron jobs                               │
│  • Teams, traces, channels, memory                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Tool Invocation

```
┌─ MCP Client ──────────────────────────────────────┐
│ request: { method: "call_tool", params: {...} }  │
└─────────────────┬────────────────────────────────┘
                  │
        ┌─────────▼────────────┐
        │ Transport            │
        │ • stdio: via pipes   │
        │ • HTTP: via POST     │
        └─────────┬────────────┘
                  │
        ┌─────────▼──────────────────┐
        │ MCP Server                 │
        │ 1. Parse tool call         │
        │ 2. Locate handler          │
        │ 3. Validate params (Zod)   │
        └─────────┬──────────────────┘
                  │
        ┌─────────▼──────────────────┐
        │ Tool Handler               │
        │ (in register-*-tools.ts)   │
        │ 1. Call client method      │
        │ 2. Handle errors           │
        │ 3. Format response         │
        │ 4. Audit log invocation    │
        └─────────┬──────────────────┘
                  │
        ┌─────────▼──────────────────┐
        │ GoClaw Client              │
        │ (goclaw-client.ts)         │
        │ Route to endpoint module   │
        └─────────┬──────────────────┘
                  │
        ┌─────────▼──────────────────┐
        │ Endpoint Module            │
        │ (e.g., agent-endpoints.ts) │
        │ Build URL, params, method  │
        └─────────┬──────────────────┘
                  │
        ┌─────────▼──────────────────┐
        │ HTTP Client                │
        │ • Add auth headers         │
        │ • Check circuit breaker    │
        │ • Retry with backoff       │
        │ • Enforce 30s timeout      │
        │ • Map response/errors      │
        └─────────┬──────────────────┘
                  │
        ┌─────────▼──────────────────┐
        │ GoClaw Gateway REST API    │
        │ • Process request          │
        │ • Return JSON/error        │
        └─────────┬──────────────────┘
                  │
        ┌─────────▼──────────────────┐
        │ HTTP Client Response       │
        │ • Parse JSON               │
        │ • Handle 4xx/5xx errors    │
        │ • Unwrap response envelope │
        └─────────┬──────────────────┘
                  │
        ┌─────────▼──────────────────┐
        │ Tool Handler               │
        │ Format MCP response        │
        │ {                          │
        │   content: [{              │
        │     type: "text",          │
        │     text: "..."            │
        │   }]                       │
        │ }                          │
        └─────────┬──────────────────┘
                  │
        ┌─────────▼──────────────────┐
        │ Audit Log                  │
        │ {                          │
        │   event: "tool_invoked",   │
        │   tool: "...",             │
        │   params: {...},           │
        │   durationMs: 150,         │
        │   success: true            │
        │ }                          │
        └─────────┬──────────────────┘
                  │
        ┌─────────▼──────────────────┐
        │ Transport Response         │
        │ (Serialize to JSON-RPC)    │
        └─────────┬──────────────────┘
                  │
┌─────────────────▼──────────────────┐
│ MCP Client                         │
│ response: { result: ... } or error │
└────────────────────────────────────┘
```

---

## Module Organization

### `/src/`

```
src/
├── index.ts                 # stdio transport entry point
├── http.ts                  # HTTP transport entry point (production)
├── server.ts                # MCP server factory
├── config.ts                # Environment-based configuration loader
├── client/
│   ├── goclaw-client.ts    # Main client (aggregates endpoints)
│   ├── http-client.ts      # Low-level HTTP with retry + circuit breaker
│   ├── types.ts            # Shared type definitions (ApiResponse, etc)
│   └── endpoints/          # 13 API endpoint modules
│       ├── system-endpoints.ts
│       ├── agent-endpoints.ts
│       ├── session-endpoints.ts
│       ├── config-endpoints.ts
│       ├── provider-endpoints.ts
│       ├── mcp-server-endpoints.ts
│       ├── skill-endpoints.ts
│       ├── custom-tool-endpoints.ts
│       ├── cron-endpoints.ts
│       ├── team-endpoints.ts
│       ├── trace-endpoints.ts
│       ├── channel-endpoints.ts
│       └── memory-endpoints.ts
├── tools/                   # MCP tool registration
│   ├── index.ts            # Main registration entry
│   ├── register-system-tools.ts
│   ├── register-agent-tools.ts
│   ├── register-session-tools.ts
│   ├── register-config-tools.ts
│   ├── register-provider-tools.ts
│   ├── register-mcp-server-tools.ts
│   ├── register-skill-tools.ts
│   ├── register-custom-tool-tools.ts
│   ├── register-cron-tools.ts
│   ├── register-team-tools.ts
│   ├── register-trace-tools.ts
│   ├── register-channel-tools.ts
│   └── register-memory-tools.ts
├── resources/
│   └── index.ts            # MCP resource registration (4 URIs)
├── prompts/
│   └── index.ts            # MCP prompt registration (4 templates)
└── lib/
    ├── logger.ts           # Structured JSON logging
    ├── audit.ts            # Tool invocation audit logging
    ├── errors.ts           # Error classes & handlers
    └── rate-limiter.ts     # Token bucket rate limiting (HTTP only)
```

---

## Key Patterns & Conventions

### 1. Tool Registration Pattern

Each domain gets a `register-*-tools.ts` file:

```typescript
// register-agent-tools.ts
export function registerAgentTools(server: McpServer, client: GoClawClient): void {
  server.tool(
    "goclaw_agent_list",
    "List all agents",
    {}, // schema: z.ZodType for parameters
    async (params) => {
      try {
        const agents = await client.agents.listAgents();
        return {
          content: [{ type: "text", text: formatOutput(agents) }],
        };
      } catch (err) {
        return handleToolError(err);
      }
    }
  );
}
```

**Pattern:**
- Tool name: `goclaw_<domain>_<action>`
- Description: Human-readable, action-focused
- Input schema: Zod type for validation
- Handler: async function, try-catch with audit
- Response: MCP-compliant text/markdown content

### 2. Endpoint Module Pattern

Each domain gets an endpoint module in `client/endpoints/`:

```typescript
// agent-endpoints.ts
export function agentEndpoints(http: HttpClient) {
  return {
    listAgents: () => http.get("/agents"),
    getAgent: (agentId: string) => http.get(`/agents/${agentId}`),
    createAgent: (body: CreateAgentRequest) =>
      http.post("/agents", body),
    // ... more endpoints
  };
}
```

**Pattern:**
- Export factory function taking `HttpClient`
- Return object with method per API operation
- Method names: camelCase, verb-first (`listAgents`, `createAgent`)
- Paths: REST conventions (`/agents`, `/agents/{id}`)

### 3. Error Handling Pattern

```typescript
// In tool handler
try {
  const result = await client.agents.getAgent(agentId);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
} catch (err) {
  return handleToolError(err); // Returns MCP error content
}
```

`handleToolError` (lib/errors.ts):
- Catches GoClawError, maps to readable message
- Returns MCP-formatted error response
- Includes HTTP status, error message, details

### 4. Configuration Pattern

Environment-based, validated on startup:

```typescript
// config.ts
export function loadConfig(): Config {
  const goClawServer = process.env.GOCLAW_SERVER;
  if (!goClawServer) throw new Error("GOCLAW_SERVER required");
  // ... validate all env vars
  return { goClawServer, goClawToken, ... };
}
```

**Pattern:**
- Validate at load time (fail fast)
- Use sensible defaults
- Document all variables in `.env.example`

### 5. Audit Logging Pattern

```typescript
// In tool handler
const start = Date.now();
try {
  const result = await client.agents.listAgents();
  auditToolInvocation({
    tool: "goclaw_agent_list",
    params: params,
    durationMs: Date.now() - start,
    success: true,
  });
  // ... return result
} catch (err) {
  auditToolInvocation({
    tool: "goclaw_agent_list",
    params: params,
    durationMs: Date.now() - start,
    success: false,
    error: err.message,
  });
}
```

**Pattern:**
- Timestamp before/after for duration
- Always audit, success and failure
- Use structured logging (JSON)
- Scrub sensitive fields (tokens, passwords, content)

---

## HTTP Client: Retry & Circuit Breaker

### Retry Logic

```
Request attempt 1
├─ Timeout or 5xx? → Wait 200ms → Attempt 2
├─ Timeout or 5xx? → Wait 400ms → Attempt 3
└─ Timeout or 5xx? → Wait 800ms → Attempt 4 (final)
   └─ Failure → Throw GoClawError
```

**Config:**
- `MAX_RETRIES = 3` (4 total attempts)
- `BASE_DELAY_MS = 200`
- Exponential backoff up to `MAX_DELAY_MS = 5000`
- `REQUEST_TIMEOUT_MS = 30_000` (30 seconds)

### Circuit Breaker

```
State: CLOSED (healthy)
├─ All requests allowed
├─ Failure? → failureCount++
└─ failureCount >= 5? → State: OPEN

State: OPEN (broken)
├─ All requests rejected immediately
├─ Wait 30s cooldown (CIRCUIT_COOLDOWN_MS)
└─ Time elapsed? → State: HALF_OPEN

State: HALF_OPEN (recovering)
├─ 1 request allowed (test)
├─ Success? → Reset to CLOSED
└─ Failure? → Back to OPEN
```

**Thresholds:**
- `CIRCUIT_FAILURE_THRESHOLD = 5` consecutive failures
- `CIRCUIT_COOLDOWN_MS = 30_000` (30 seconds)

---

## Transport Modes

### stdio Transport (Local)

**Entry:** `index.ts` → `StdioServerTransport`

**Use:**
- Direct integration with Claude Code, Cursor
- Local development
- Single client at a time

**Session management:** N/A (single process, single client)

### Streamable HTTP Transport (Production)

**Entry:** `http.ts` → `StreamableHTTPServerTransport`

**Endpoints:**
- `POST /mcp` — Create new session (no session ID header)
- `POST /mcp` + `mcp-session-id` header — Existing session request
- `DELETE /mcp` + `mcp-session-id` header — Terminate session
- `GET /health` — Health check (returns `{ status: "ok", version: "..." }`)

**Session Lifecycle:**

```
1. Client POST to /mcp (no session ID)
   ├─ Server creates new McpServer instance
   ├─ Server creates StreamableHTTPServerTransport
   ├─ Server.connect(transport) to establish link
   ├─ Transport generates sessionId (UUID)
   ├─ Client receives sessionId in response headers
   ├─ Server stores { sessionId: { server, transport } }
   └─ Rate limiter initialized for this session

2. Client POST to /mcp with mcp-session-id header
   ├─ Server locates session by ID
   ├─ Rate limit check (token bucket)
   ├─ transport.handleRequest() processes request
   └─ Response sent back with session ID preserved

3. Client DELETE to /mcp with mcp-session-id header
   ├─ Server locates session
   ├─ transport.close() called
   ├─ Session removed from map
   ├─ Rate limiter cleanup
   └─ Response: 200 OK or 404 if not found
```

**Security:**
- Origin validation against `GOCLAW_MCP_ALLOWED_ORIGINS`
- Request body size limit: 1MB
- Rate limiting: Token bucket (configurable rpm)
- Timeout: 30s per request

---

## Tool Invocation Example: Agent Creation

**User command:**
```
"Create a web scraper agent"
```

**MCP Client:** Calls `goclaw_agent_create` with:
```json
{
  "agent_key": "web-scraper",
  "display_name": "Web Scraper",
  "provider": "openai",
  "model": "gpt-4o",
  "instructions": "You are a web scraper..."
}
```

**Flow:**
1. MCP Server receives request
2. `register-agent-tools.ts` handler validates params (Zod)
3. Calls `client.agents.createAgent(params)`
4. `agent-endpoints.ts` constructs `POST /agents` with body
5. `http-client.ts` performs request:
   - Adds `Authorization: Bearer {token}` header
   - Adds `X-GoClaw-User-Id: {userId}` if configured
   - Retries if 5xx/timeout (up to 3 times)
   - Checks circuit breaker
   - 30s timeout
6. GoClaw Gateway processes, returns `{ agent_id: "...", ... }`
7. `http-client.ts` unwraps response envelope
8. Tool handler formats as MCP content
9. `auditToolInvocation()` logs the call (scrubbed)
10. MCP client receives response with agent details

---

## Error Handling Hierarchy

```
┌─ JavaScript Error ─────────────────┐
│ (native thrown error)              │
└────────────────┬────────────────────┘
                 │
        ┌────────▼──────────┐
        │ HTTP Client       │
        │ • Timeout?        │
        │ • Network error?  │
        │ • 4xx response?   │
        │ • 5xx response?   │
        └────────┬──────────┘
                 │
        ┌────────▼──────────────────────┐
        │ GoClawError (lib/errors.ts)   │
        │ ├── statusCode: number        │
        │ ├── message: string           │
        │ ├── data: ApiErrorData        │
        │ └── retryable: boolean        │
        └────────┬──────────────────────┘
                 │
        ┌────────▼──────────────────────┐
        │ handleToolError()              │
        │ ├── Catch GoClawError         │
        │ ├── Format MCP error response │
        │ └── Return to MCP client      │
        └────────────────────────────────┘
```

---

## Performance Characteristics

| Aspect | Behavior |
|--------|----------|
| **Memory (idle)** | ~30MB (Node.js overhead + dependencies) |
| **Memory per session** | ~50KB (session state, transport buffers) |
| **Tool call latency (p50)** | 200-500ms (network-bound) |
| **Tool call latency (p99)** | 1-5s (retry scenarios) |
| **Concurrent sessions** | Thousands (limited by memory) |
| **Request throughput (HTTP)** | 100+ req/s per core |
| **Circuit breaker recovery** | 30s cooldown, then half-open test |

---

## Security Architecture

### Input Validation

- **Zod schemas** on all tool parameters
- **Type checking** at compile time
- **Range validation** on numeric inputs
- **Format validation** on IDs, URIs, emails

### Authentication

- **Bearer token** from `GOCLAW_TOKEN` env
- **Forwarded to every GoClaw request** via `Authorization` header
- **Role-based access control** enforced by GoClaw (passthrough)
- **Optional user scoping** via `X-GoClaw-User-Id` header

### Audit Trail

- **Every tool invocation logged**
- **Who:** sessionId (HTTP), userId (if provided)
- **What:** tool name, parameters (scrubbed)
- **When:** timestamp, duration
- **Result:** success/failure, error details
- **Format:** Structured JSON (SIEM-friendly)

### Secret Scrubbing

Sensitive fields never appear in logs:
- `token`, `password`, `secret`, `api_key`, `content`, `config`
- Long values (>200 chars) truncated with `...[truncated]`
- Happens in `auditToolInvocation()` before logging

### Origin Validation (HTTP)

- **Against:** `GOCLAW_MCP_ALLOWED_ORIGINS` (default: `localhost`)
- **Method:** Extract hostname from `Origin` header
- **Prevents:** DNS rebinding attacks
- **Response:** 403 Forbidden if origin not allowed

---

## Deployment Considerations

### Load Balancing

For HTTP transport behind a load balancer:
- **Session affinity required** (sticky session to same backend)
- Or: Shared session store (Redis) for horizontal scaling
- Current: In-memory only (per-instance)

### Monitoring

- **Health endpoint:** `GET /health` → 200 with `{ status: "ok" }`
- **Log levels:** debug, info, warn, error (configurable)
- **Audit logs:** Structured JSON, exportable to SIEM
- **Metrics:** Consider Prometheus integration (future)

### Scaling

- **Vertical:** Increase Node.js heap, raise rate limits
- **Horizontal:** Multiple instances behind load balancer (requires sticky sessions or shared state)
- **Rate limiting:** Per-session, not global

---

**Last Updated:** 2026-03-15
**Architecture Version:** 1.0
