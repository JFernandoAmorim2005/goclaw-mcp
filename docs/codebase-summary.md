# GoClaw MCP Server — Codebase Summary

**Generated from:** `repomix-output.xml` on 2026-03-15
**Codebase Size:** ~47,200 tokens | 60 files
**Language:** TypeScript 5.9.3+ (ESM)

---

## Quick Navigation

- **Setup & Installation:** See `deployment-guide.md`
- **Architecture Overview:** See `system-architecture.md`
- **Code Standards:** See `code-standards.md`
- **Requirements & Strategy:** See `project-overview-pdr.md`

---

## Directory Structure

```
goclaw-mcp/
├── src/                                  # TypeScript source
│   ├── index.ts                         # stdio transport entry
│   ├── http.ts                          # Streamable HTTP transport
│   ├── server.ts                        # MCP server factory
│   ├── config.ts                        # Env-based configuration
│   ├── client/                          # GoClaw API client
│   │   ├── goclaw-client.ts            # Main client aggregator
│   │   ├── http-client.ts              # Low-level HTTP (retry, circuit breaker)
│   │   ├── types.ts                    # Shared type definitions
│   │   └── endpoints/                  # 13 API endpoint modules
│   │       ├── system-endpoints.ts
│   │       ├── agent-endpoints.ts
│   │       ├── session-endpoints.ts
│   │       ├── config-endpoints.ts
│   │       ├── provider-endpoints.ts
│   │       ├── mcp-server-endpoints.ts
│   │       ├── skill-endpoints.ts
│   │       ├── custom-tool-endpoints.ts
│   │       ├── cron-endpoints.ts
│   │       ├── team-endpoints.ts
│   │       ├── trace-endpoints.ts
│   │       ├── channel-endpoints.ts
│   │       └── memory-endpoints.ts
│   ├── tools/                           # MCP tool registrations
│   │   ├── index.ts                    # Master registration
│   │   ├── register-system-tools.ts
│   │   ├── register-agent-tools.ts
│   │   ├── register-session-tools.ts
│   │   ├── register-config-tools.ts
│   │   ├── register-provider-tools.ts
│   │   ├── register-mcp-server-tools.ts
│   │   ├── register-skill-tools.ts
│   │   ├── register-custom-tool-tools.ts
│   │   ├── register-cron-tools.ts
│   │   ├── register-team-tools.ts
│   │   ├── register-trace-tools.ts
│   │   ├── register-channel-tools.ts
│   │   └── register-memory-tools.ts
│   ├── resources/
│   │   └── index.ts                    # 4 MCP resources (URIs)
│   ├── prompts/
│   │   └── index.ts                    # 4 MCP prompts (templates)
│   └── lib/                             # Utilities
│       ├── logger.ts                   # Structured JSON logging
│       ├── audit.ts                    # Tool invocation audit
│       ├── errors.ts                   # GoClawError class & handler
│       └── rate-limiter.ts             # Token bucket limiter
├── tests/                               # Test suite
│   └── unit/
│       ├── config.test.ts              # Config loading tests
│       ├── errors.test.ts              # Error handling tests
│       └── rate-limiter.test.ts        # Rate limiter tests
├── dist/                                # Build output (generated)
│   ├── index.js
│   ├── http.js
│   └── *.d.ts
├── plans/                               # Development plans
│   └── 260315-1135-goclaw-mcp-server/
│       ├── phase-01-project-setup.md
│       ├── phase-02-goclaw-api-client.md
│       ├── phase-03-core-mcp-tools.md
│       └── ...
├── docs/                                # Documentation (THIS)
│   ├── project-overview-pdr.md
│   ├── system-architecture.md
│   ├── code-standards.md
│   ├── codebase-summary.md
│   └── deployment-guide.md
├── package.json                         # pnpm manifest
├── pnpm-lock.yaml                       # Dependency lock
├── tsconfig.json                        # TypeScript config
├── tsup.config.ts                       # Build config
├── vitest.config.ts                     # Test config
└── .env.example                         # Configuration template
```

---

## Core Modules

### Entry Points

#### `src/index.ts` — stdio Transport

```typescript
// Local development, direct MCP client integration
// Used by: Claude Code, Cursor, etc.
// Transport: StdioServerTransport (stdin/stdout pipes)
// Sessions: Single client at a time
// Config: Environment variables only
```

**Flow:**
1. Load config from env
2. Create MCP server (with all tools, resources, prompts)
3. Create StdioServerTransport
4. Connect server to transport
5. Listen on stdin indefinitely

**Usage:**
```bash
GOCLAW_SERVER=http://localhost:8080 GOCLAW_TOKEN=admin npx goclaw-mcp
```

#### `src/http.ts` — Streamable HTTP Transport

```typescript
// Production deployment, multi-client support
// Transport: StreamableHTTPServerTransport (JSON-RPC over HTTP)
// Sessions: Multiple concurrent clients with session IDs
// Config: Environment variables only
```

**Endpoints:**
- `POST /mcp` — New session (generates session ID)
- `POST /mcp` + `mcp-session-id` header — Existing session request
- `DELETE /mcp` + `mcp-session-id` header — Terminate session
- `GET /health` — Health check

**Features:**
- Origin validation (CORS)
- Request size limit (1MB)
- Per-session rate limiting (token bucket)
- Automatic session cleanup
- Graceful shutdown (SIGINT/SIGTERM)

**Usage:**
```bash
GOCLAW_MCP_PORT=3100 npx goclaw-mcp-http
# Endpoint: http://localhost:3100/mcp
```

### Server Factory

#### `src/server.ts` — createServer()

```typescript
export function createServer(config: Config): McpServer
```

**Responsibilities:**
1. Create McpServer instance with name/version
2. Instantiate GoClawClient with config (baseUrl, token, userId)
3. Register all 66 tools (via 13 domain registrars)
4. Register 4 resources (goclaw://status, models, agents, config)
5. Register 4 prompts (setup, troubleshoot, review, optimize)
6. Return configured server

**Pattern:** Singleton per transport instance (HTTP creates new one per session).

### Configuration

#### `src/config.ts` — loadConfig()

```typescript
export interface Config {
  goClawServer: string;           // Required: gateway URL
  goClawToken?: string;           // Optional: bearer token
  goClawUserId?: string;          // Optional: user context
  mcpPort: number;                // Default: 3100
  allowedOrigins: string[];       // Default: [localhost, 127.0.0.1, ::1]
  rateLimitRpm: number;           // Default: 60
  logLevel: "debug" | "info" | "warn" | "error"; // Default: info
}

export function loadConfig(): Config
```

**Validation:**
- `GOCLAW_SERVER` required, error if missing
- `GOCLAW_MCP_PORT` validated as 1-65535, default 3100
- Origins comma-separated, trimmed
- Log level validated against enum
- Trailing slashes stripped from server URL

**Fail-fast approach:** Throws on invalid config (startup error, not runtime).

---

## Client Layer

### HTTP Client

#### `src/client/http-client.ts` — Low-level HTTP

```typescript
export class HttpClient {
  async get<T>(path: string): Promise<T>
  async post<T>(path: string, body?: unknown): Promise<T>
  async put<T>(path: string, body?: unknown): Promise<T>
  async patch<T>(path: string, body?: unknown): Promise<T>
  async del<T = void>(path: string): Promise<T>
  private async request<T>(method, path, body): Promise<T>
  private checkCircuit(): void
}
```

**Features:**

1. **Authentication:**
   - Adds `Authorization: Bearer {token}` header
   - Adds `X-GoClaw-User-Id: {userId}` header (if configured)

2. **Retry Logic:**
   - Max 3 retries (4 total attempts)
   - Exponential backoff: 200ms → 400ms → 800ms
   - Capped at 5000ms
   - Retries on 5xx and timeout, not 4xx

3. **Circuit Breaker:**
   - Tracks consecutive failures
   - Opens after 5 failures
   - Prevents cascading failures
   - Half-open state tests recovery
   - 30s cooldown before retry

4. **Timeout:**
   - 30 seconds per request (REQUEST_TIMEOUT_MS)
   - Enforced via fetch() options

5. **Error Mapping:**
   - 4xx/5xx → GoClawError with statusCode, message, data
   - Network errors → GoClawError with retryable=true
   - Wraps response envelope

#### `src/client/goclaw-client.ts` — Client Aggregator

```typescript
export interface GoClawClientOptions {
  baseUrl: string;
  token?: string;
  userId?: string;
}

export class GoClawClient {
  public system: ReturnType<typeof systemEndpoints>;
  public agents: ReturnType<typeof agentEndpoints>;
  public sessions: ReturnType<typeof sessionEndpoints>;
  // ... 13 endpoint groups
}
```

**Pattern:** Constructor initializes HttpClient, then creates all 13 endpoint modules, passing HttpClient to each.

#### Endpoint Modules (13)

Each module exports a factory function taking `HttpClient`, returning object with methods:

```typescript
// agent-endpoints.ts
export function agentEndpoints(http: HttpClient) {
  return {
    listAgents: () => http.get<Agent[]>("/agents"),
    getAgent: (id: string) => http.get<Agent>(`/agents/${id}`),
    createAgent: (body: CreateAgentRequest) => http.post<Agent>("/agents", body),
    updateAgent: (id: string, body: UpdateAgentRequest) =>
      http.put<Agent>(`/agents/${id}`, body),
    deleteAgent: (id: string) => http.del(`/agents/${id}`),
    listAgentFiles: (id: string) => http.get<AgentFile[]>(`/agents/${id}/files`),
    getAgentFile: (id: string, name: string) =>
      http.get<AgentFile>(`/agents/${id}/files/${name}`),
    setAgentFile: (id: string, name: string, content: string) =>
      http.put(`/agents/${id}/files/${name}`, { content }),
    deleteAgentFile: (id: string, name: string) =>
      http.del(`/agents/${id}/files/${name}`),
    listDelegationLinks: (id: string) => http.get(`/agents/${id}/links`),
    setDelegationLink: (id: string, body: DelegationLinkRequest) =>
      http.put(`/agents/${id}/links`, body),
    removeDelegationLink: (id: string, target: string) =>
      http.del(`/agents/${id}/links/${target}`),
    shareAgent: (id: string, userId: string) =>
      http.post(`/agents/${id}/share`, { user_id: userId }),
  };
}
```

**Module Summary:**

| Module | Endpoints | Primary Functions |
|--------|-----------|-------------------|
| `system-endpoints` | 3 | health(), status(), listModels() |
| `agent-endpoints` | 13 | CRUD, files, delegation, sharing |
| `session-endpoints` | 5 | list, preview, delete, reset, label |
| `config-endpoints` | 3 | get, apply, patch |
| `provider-endpoints` | 5 | CRUD for LLM providers |
| `mcp-server-endpoints` | 7 | CRUD, grant agent/user access |
| `skill-endpoints` | 5 | list, get, update, grant |
| `custom-tool-endpoints` | 6 | CRUD, invoke |
| `cron-endpoints` | 6 | CRUD, toggle, run |
| `team-endpoints` | 5 | CRUD |
| `trace-endpoints` | 2 | list, get with spans |
| `channel-endpoints` | 2 | list, toggle |
| `memory-endpoints` | 4 | CRUD documents |

---

## Tool Registration

### Pattern

Each domain gets a `register-*-tools.ts` file exporting one function:

```typescript
export function register<Domain>Tools(server: McpServer, client: GoClawClient): void
```

**Template:**
```typescript
server.tool(
  "goclaw_<domain>_<action>",
  "Human-readable description",
  {
    param1: z.string().describe("..."),
    param2: z.number().min(1).describe("..."),
    // ... Zod schema for input validation
  },
  async (params) => {
    try {
      const result = await client.<domain>.<action>(params);

      // Format output
      return {
        content: [
          {
            type: "text",
            text: formatResult(result),
          },
        ],
      };
    } catch (err) {
      return handleToolError(err);
    }
  }
);
```

### Tool Inventory (66 Tools)

| Domain | Count | Example Tools |
|--------|-------|----------------|
| System | 3 | goclaw_health, goclaw_status, goclaw_models_list |
| Agents | 13 | goclaw_agent_list, goclaw_agent_create, goclaw_agent_files_set |
| Sessions | 5 | goclaw_session_list, goclaw_session_preview, goclaw_session_delete |
| Config | 3 | goclaw_config_get, goclaw_config_apply, goclaw_config_patch |
| Providers | 5 | goclaw_provider_list, goclaw_provider_create, goclaw_provider_update |
| MCP Servers | 7 | goclaw_mcp_server_list, goclaw_mcp_server_grant_agent |
| Skills | 5 | goclaw_skill_list, goclaw_skill_update, goclaw_skill_grant_agent |
| Custom Tools | 6 | goclaw_custom_tool_create, goclaw_custom_tool_invoke |
| Cron Jobs | 6 | goclaw_cron_list, goclaw_cron_create, goclaw_cron_run |
| Teams | 5 | goclaw_team_list, goclaw_team_create, goclaw_team_delete |
| Traces | 2 | goclaw_trace_list, goclaw_trace_get |
| Channels | 2 | goclaw_channel_list, goclaw_channel_toggle |
| Memory | 4 | goclaw_memory_list, goclaw_memory_create, goclaw_memory_delete |

---

## Resources & Prompts

### Resources (4)

**File:** `src/resources/index.ts`

| URI | Type | Content |
|-----|------|---------|
| `goclaw://status` | text | Gateway status (version, uptime, connections, agents, sessions) |
| `goclaw://models` | text | Available LLM models (name, provider, context window) |
| `goclaw://agents` | text | All agents list (display_name, agent_key, provider/model, type) |
| `goclaw://config` | json | Current gateway configuration (JSON) |

**Pattern:** Each resource is a read-only endpoint that fetches live data from GoClaw.

### Prompts (4)

**File:** `src/prompts/index.ts`

| Prompt | Input | Purpose |
|--------|-------|---------|
| `goclaw_setup_agent` | agent_purpose | Guided agent creation workflow |
| `goclaw_troubleshoot` | symptom | Systematic troubleshooting steps |
| `goclaw_review_config` | (none) | Configuration review for improvements |
| `goclaw_optimize_agent` | agent_id | Optimization suggestions for agent |

**Pattern:** Each prompt returns an MCP message suggesting a sequence of tool calls.

---

## Utilities

### Logger

**File:** `src/lib/logger.ts`

```typescript
export class Logger {
  setLevel(level: "debug" | "info" | "warn" | "error"): void
  debug(message: string, data?: Record<string, unknown>): void
  info(message: string, data?: Record<string, unknown>): void
  warn(message: string, data?: Record<string, unknown>): void
  error(message: string, data?: Record<string, unknown>): void
}

export const logger = new Logger();
```

**Output:** Structured JSON with timestamp, level, message, and data fields.

### Audit Logging

**File:** `src/lib/audit.ts`

```typescript
export interface AuditEntry {
  tool: string;
  params: Record<string, unknown>;
  sessionId?: string;
  userId?: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

export function auditToolInvocation(entry: AuditEntry): void
```

**Features:**
- Logs every tool call with timing
- Scrubs sensitive fields (token, password, secret, api_key, content, config)
- Truncates long values (>200 chars)
- Suitable for SIEM export

### Error Handling

**File:** `src/lib/errors.ts`

```typescript
export interface ApiErrorData {
  code?: string;
  details?: string;
}

export class GoClawError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public data?: ApiErrorData,
    public retryable?: boolean
  ) { ... }
}

export function handleToolError(err: unknown): ToolResponse { ... }
```

**Error Response Format:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: <message>\nStatus: <statusCode>"
    }
  ],
  "isError": true
}
```

### Rate Limiter

**File:** `src/lib/rate-limiter.ts`

```typescript
export class RateLimiter {
  constructor(rpm: number)  // requests per minute
  allow(sessionId: string): boolean
  retryAfter(sessionId: string): number  // seconds
  remove(sessionId: string): void
  destroy(): void
}
```

**Algorithm:** Token bucket
- Burst capacity = rpm (1 minute's worth)
- Refill rate = rpm / 60000 tokens/ms
- Cleanup: Stale buckets removed every 5 minutes

---

## Testing

**File:** `tests/unit/`

### Test Files

1. **config.test.ts** — Configuration loading
   - GOCLAW_SERVER required
   - Default values
   - Port validation
   - Origin parsing

2. **errors.test.ts** — Error classes and handling
   - GoClawError instantiation
   - handleToolError formatting
   - Error response structure

3. **rate-limiter.test.ts** — Rate limiting
   - Token refill
   - Burst capacity
   - Rate-limited responses
   - Cleanup

**Runner:** vitest (Node environment)

**Coverage Target:** ≥80% overall, 100% for critical paths

---

## Build & Distribution

### Build Configuration

**File:** `tsup.config.ts`

```typescript
export default defineConfig({
  entry: {
    index: "src/index.ts",
    http: "src/http.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
});
```

**Outputs:**
- `dist/index.js` — stdio transport
- `dist/http.js` — HTTP transport
- `dist/*.d.ts` — TypeScript declarations

### Package Configuration

**File:** `package.json`

```json
{
  "name": "goclaw-mcp",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "goclaw-mcp": "./dist/index.js",
    "goclaw-mcp-http": "./dist/http.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.27.1",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/node": "^25.5.0",
    "tsup": "^8.5.1",
    "typescript": "^5.9.3",
    "vitest": "^4.1.0"
  }
}
```

---

## Key Data Types

### Common Request/Response Types

```typescript
// Config/System
interface Config { goClawServer, goClawToken?, goClawUserId?, ... }
interface Status { version, uptime, connections, agents, sessions }

// Agents
interface Agent {
  agent_id: string;
  agent_key: string;
  display_name: string;
  provider: string;
  model: string;
  agent_type: string;
  // ...
}

// Sessions
interface Session { session_id, user_id?, agent_id?, created_at, ... }

// Generic MCP Response
interface ToolResponse {
  content: Array<{ type: "text" | "image" | "resource"; text?: string; ... }>;
  isError?: boolean;
}
```

---

## Development Patterns

### Common Workflows

**Adding a new tool:**
1. Create/update endpoint in `client/endpoints/`
2. Add to GoClawClient in `goclaw-client.ts`
3. Create tool handler in `tools/register-*-tools.ts`
4. Add Zod schema for validation
5. Wrap with try-catch and audit logging
6. Test with vitest

**Debugging HTTP client:**
1. Set `GOCLAW_LOG_LEVEL=debug` for verbose logging
2. Check circuit breaker state in rate-limiter output
3. Review audit logs for request timing/failures
4. Check GoClaw server logs for rejection reasons

**Performance tuning:**
1. Monitor memory usage: `node --inspect dist/http.js`
2. Check rate limiter cleanup effectiveness
3. Profile tool call latency: Add timestamps in audit logs
4. Consider circuit breaker thresholds if flaky network

---

## Dependencies

### Production

- **@modelcontextprotocol/sdk@1.27.1** — MCP protocol implementation
- **zod@4.3.6** — Runtime validation (schemas, runtime checks)

### Development

- **@types/node@25.5.0** — Node.js type definitions
- **tsup@8.5.1** — Build tool (bundling, ESM output)
- **typescript@5.9.3** — Language compiler
- **vitest@4.1.0** — Test runner (Vitest)

**No external HTTP library:** Uses Node.js native fetch() (available in Node 18+).

---

## Key Concepts

### MCP Protocol

- **Tools:** Callable functions with input schemas and text/markdown output
- **Resources:** Read-only URIs providing context (status, models, etc.)
- **Prompts:** Reusable message templates for common workflows
- **Transport:** Mechanism for client-server communication (stdio or HTTP)

### Retry & Circuit Breaker

- **Retry:** Handles transient failures (network hiccups, 5xx errors)
- **Circuit Breaker:** Protects against cascading failures in failing backend
- **Together:** Resilient to temporary outages, fast-fail when persistent issue

### Audit Trail

- **What:** Every tool invocation logged with timing and result
- **Who:** Optional sessionId and userId context
- **Security:** Sensitive fields scrubbed before logging
- **Export:** Structured JSON suitable for SIEM/compliance

---

## Code Generation & Maintenance

### Known Limitations

1. **Type definitions** generated from code, not separate schema file
2. **Tool names** hardcoded in registrars (no auto-generation)
3. **Endpoint URLs** hardcoded in endpoint modules (no OpenAPI import)
4. **Rate limiter** per-session only (no global limit)
5. **Session persistence** in-memory only (restart loses sessions)

### Maintenance Checklist

- [ ] Update `package.json` version when releasing
- [ ] Run `pnpm lint && pnpm build && pnpm test` before merge
- [ ] Update `README.md` if API changes
- [ ] Update `.env.example` if new config added
- [ ] Update docs if tool or resource added
- [ ] Test locally with real GoClaw instance before publishing

---

## File Statistics

**Total Files:** 60
**TypeScript Files:** 43
**Test Files:** 3
**Documentation:** 8
**Configuration:** 6

**Token Count:** ~47,200 tokens
**Code Lines:** ~2,500 LOC (excluding tests/docs)

---

**Last Updated:** 2026-03-15
**Generated by:** repomix
**Documentation Version:** 1.0
