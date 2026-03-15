# GoClaw MCP Server — Code Standards

## Language & Tooling

- **Language:** TypeScript 5.9.3+ (strict mode mandatory)
- **Runtime:** Node.js 20.0.0+ (ESM modules only)
- **Package Manager:** pnpm (deterministic lockfile)
- **Build Tool:** tsup (fast bundling, ESM output)
- **Test Runner:** vitest (ESM, fast, vite-compatible)

---

## TypeScript Configuration

### Compiler Options (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,                    // All strict checks enabled
    "esModuleInterop": true,           // Default imports from CJS
    "skipLibCheck": true,              // Skip type checking deps
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,               // .d.ts files generated
    "declarationMap": true,            // Maps to source
    "sourceMap": true,                 // Debug support
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022"]
  }
}
```

**Enforcement:**
- `strict: true` requires all strict flags (`strictNullChecks`, `strictFunctionTypes`, etc.)
- CI/CD runs `pnpm lint` (tsc --noEmit) before merge
- No `any` types without explicit `// @ts-ignore` comment with reason

---

## Naming Conventions

### Files

- **Pattern:** kebab-case for all `.ts` files
- **Tool registrars:** `register-<domain>-tools.ts` (e.g., `register-agent-tools.ts`)
- **Endpoint modules:** `<domain>-endpoints.ts` (e.g., `agent-endpoints.ts`)
- **Library utilities:** `<function>.ts` (e.g., `logger.ts`, `audit.ts`, `errors.ts`)
- **Test files:** `<module>.test.ts` (e.g., `config.test.ts`)

### Functions & Variables

- **Pattern:** camelCase
- **Async functions:** Verb-first (e.g., `fetchAgents()`, `createSession()`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`, `CIRCUIT_COOLDOWN_MS`)
- **Private methods:** `#private` (ES2022) or underscore prefix `_private()`
- **Boolean getters:** Prefix with `is`, `has`, `can` (e.g., `isRateLimited()`, `hasSession()`)

### Types & Interfaces

- **Pattern:** PascalCase
- **Interfaces:** Descriptive names (e.g., `HttpClientOptions`, `AuditEntry`, `Config`)
- **Type aliases:** Same as interfaces
- **Enums:** PascalCase members (e.g., `CircuitState.OPEN`, `LogLevel.INFO`)

### Exports

- **Named exports preferred** over default exports
- **Exception:** Entry points may use default (index.ts, http.ts)
- **Export groups:** Related items grouped with comment

---

## Module Organization

### Directory Structure

```
src/
├── client/         # GoClaw API client (HTTP + endpoints)
├── tools/          # MCP tool registrations (13 domains)
├── resources/      # MCP resource definitions (4 URIs)
├── prompts/        # MCP prompt templates (4 prompts)
├── lib/            # Utility & infrastructure modules
│   ├── logger.ts   # Structured JSON logging
│   ├── audit.ts    # Tool invocation audit trail
│   ├── errors.ts   # Error classes & handling
│   └── rate-limiter.ts
├── config.ts       # Environment-based config
├── server.ts       # MCP server factory
├── index.ts        # stdio transport entry
└── http.ts         # HTTP transport entry
```

### Module Size Limits

- **Target:** Individual `.ts` files under 300 LOC
- **Large files:** Consider splitting into focused modules
- **Configuration:** Keep config loading simple, validation inline

### Module Dependencies

**Allowed:**
```
index.ts, http.ts → server.ts → client/, tools/, resources/, prompts/
                 → config.ts
                 → lib/*

client/ → lib/errors.ts, lib/logger.ts
tools/ → client/, lib/
```

**Disallowed:**
- Circular imports (use tsconfig path aliases if needed)
- Importing from dist/ (always import from src/)
- Node.js fs/path operations outside lib/ (for portability)

---

## Error Handling

### Custom Error Classes

```typescript
// In lib/errors.ts
export class GoClawError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public data?: ApiErrorData,
    public retryable?: boolean
  ) {
    super(message);
    this.name = "GoClawError";
  }
}
```

### Error Usage Patterns

**Throwing errors:**
```typescript
if (!token) {
  throw new Error("GOCLAW_TOKEN environment variable required");
}

// HTTP errors mapped to GoClawError
const response = await fetch(url);
if (!response.ok) {
  const data = await response.json().catch(() => ({}));
  throw new GoClawError(
    response.status,
    `Failed to fetch ${path}`,
    data,
    response.status >= 500 // retryable on 5xx
  );
}
```

**In tool handlers:**
```typescript
try {
  const agents = await client.agents.listAgents();
  return { content: [{ type: "text", text: formatAgents(agents) }] };
} catch (err) {
  return handleToolError(err); // Returns MCP error content
}
```

**In HTTP server:**
```typescript
if (!rateLimiter.allow(sessionId)) {
  res.writeHead(429, { "Retry-After": String(retryAfter) });
  res.end(JSON.stringify({ error: "Too many requests" }));
}
```

### Error Response Format

```typescript
function handleToolError(err: unknown) {
  if (err instanceof GoClawError) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${err.message}\nStatus: ${err.statusCode}`,
        },
      ],
      isError: true,
    };
  }
  return {
    content: [{ type: "text", text: `Unexpected error: ${String(err)}` }],
    isError: true,
  };
}
```

---

## Input Validation

### Zod Schemas

All tool parameters validated via Zod:

```typescript
server.tool(
  "goclaw_agent_create",
  "Create a new GoClaw agent",
  {
    agent_key: z.string().min(1).max(100).describe("Unique agent identifier"),
    display_name: z.string().min(1).describe("User-friendly name"),
    provider: z.string().describe("LLM provider (e.g., 'openai')"),
    model: z.string().describe("Model name"),
    instructions: z.string().optional().describe("System prompt"),
  },
  async (params) => {
    // params fully typed and validated
    const { agent_key, display_name, provider, model } = params;
    // ...
  }
);
```

**Validation rules:**
- All parameters have schemas
- Use `.describe()` for UI hints
- Discriminate unions for complex inputs
- Use `.transform()` for normalization (trim whitespace, lowercase)
- Never skip validation — invalid input is a client bug, not a server issue

### Config Validation

```typescript
export function loadConfig(): Config {
  const goClawServer = process.env.GOCLAW_SERVER;
  if (!goClawServer) {
    throw new Error("GOCLAW_SERVER required");
  }

  const mcpPort = parseInt(process.env.GOCLAW_MCP_PORT ?? "3100", 10);
  if (isNaN(mcpPort) || mcpPort < 1 || mcpPort > 65535) {
    throw new Error("GOCLAW_MCP_PORT must be 1-65535");
  }

  return { goClawServer, mcpPort, /* ... */ };
}
```

**Pattern:**
- Validate immediately on load (fail fast)
- Include helpful error messages with valid ranges/formats
- Provide sensible defaults only for truly optional values

---

## Async & Promise Handling

### Async Functions

```typescript
// Use async/await, not .then() chains
async function listAgents(): Promise<Agent[]> {
  const response = await client.get<Agent[]>("/agents");
  return response;
}

// For parallel operations, use Promise.all()
const [agents, sessions] = await Promise.all([
  client.agents.listAgents(),
  client.sessions.listSessions(),
]);

// For racing, use Promise.race()
const result = await Promise.race([
  fetch(primaryUrl),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), 5000)
  ),
]);
```

### Error Handling in Async

```typescript
// Always wrap async operations in try-catch
async function fetchAgents() {
  try {
    return await client.agents.listAgents();
  } catch (err) {
    logger.error("Failed to fetch agents", { error: String(err) });
    return []; // graceful fallback
  }
}

// In tool handlers, always use try-catch
server.tool("goclaw_agent_list", "...", {}, async () => {
  try {
    const agents = await client.agents.listAgents();
    return { content: [{ type: "text", text: JSON.stringify(agents) }] };
  } catch (err) {
    return handleToolError(err);
  }
});
```

### Promises in Server Start

```typescript
// http.ts entry point
async function main() {
  try {
    const config = loadConfig();
    // ... setup
    httpServer.listen(config.mcpPort, () => {
      logger.info("Server listening");
    });
  } catch (err) {
    logger.error("Fatal error", { error: String(err) });
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error("Unhandled error", { error: String(err) });
  process.exit(1);
});
```

---

## Logging

### Structured JSON Logging

All logs must be structured JSON for SIEM export:

```typescript
import { logger } from "./lib/logger.js";

logger.info("Message", { field1: value1, field2: value2 });
logger.warn("Warning", { error: err.message, context: "..." });
logger.error("Error", { statusCode: 500, path: "/agents" });
logger.debug("Debug info", { attempt: 1, delay: 200 });
```

**Output format:**
```json
{
  "level": "info",
  "message": "User message here",
  "timestamp": "2026-03-15T12:00:00.000Z",
  "field1": "value1",
  "field2": "value2"
}
```

### Sensitive Data

**Never log:**
- `token`, `password`, `secret`, `api_key`
- Full request bodies (especially `content` field)
- User data or authentication headers

**Instead:**
```typescript
// WRONG
logger.info("Auth header", { auth: req.headers.authorization });

// RIGHT
logger.info("Request received", { hasAuth: !!req.headers.authorization });

// Scrubbing in audit logs
function scrubParams(params: Record<string, unknown>) {
  const scrubbed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      scrubbed[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 200) {
      scrubbed[key] = value.substring(0, 200) + "...[truncated]";
    } else {
      scrubbed[key] = value;
    }
  }
  return scrubbed;
}
```

---

## Testing

### Test Organization

```
tests/
├── unit/
│   ├── config.test.ts
│   ├── errors.test.ts
│   ├── rate-limiter.test.ts
│   └── logger.test.ts
└── integration/
    └── (future: end-to-end tests)
```

### vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
```

### Test Patterns

**Unit tests:**
```typescript
import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  it("throws when GOCLAW_SERVER is missing", () => {
    delete process.env.GOCLAW_SERVER;
    expect(() => loadConfig()).toThrow("GOCLAW_SERVER");
  });

  it("loads valid configuration", () => {
    process.env.GOCLAW_SERVER = "http://localhost:8080";
    const config = loadConfig();
    expect(config.goClawServer).toBe("http://localhost:8080");
  });

  it("defaults GOCLAW_MCP_PORT to 3100", () => {
    delete process.env.GOCLAW_MCP_PORT;
    const config = loadConfig();
    expect(config.mcpPort).toBe(3100);
  });
});
```

**Test coverage targets:**
- Unit tests: ≥80% coverage
- Critical paths (auth, error handling): 100%
- Transport layer: Tested separately (integration)

---

## Comments & Documentation

### Code Comments

**When to comment:**
- **Why**, not what: Code says what, comment says why
- Complex algorithms (circuit breaker, retry logic)
- Non-obvious design decisions
- Edge cases and gotchas

**When NOT to comment:**
- Obvious code: `const count = agents.length; // get count` (bad)
- Self-documenting names: `const isRateLimited = ...` (no comment needed)
- Type-safe code already explains structure

### Comment Style

```typescript
/**
 * Token bucket rate limiter — per-session rate limiting for HTTP transport.
 * Returns 429 when bucket is exhausted.
 */
export class RateLimiter {
  /**
   * Check if request is allowed for the given session.
   * @param sessionId Unique session identifier
   * @returns true if allowed, false if rate limited
   */
  allow(sessionId: string): boolean {
    // Refill tokens based on elapsed time since last request
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + elapsed * this.refillRatePerMs);
    // ...
  }
}
```

### JSDoc

Use JSDoc for:
- Public functions and classes
- Complex parameters
- Return types (even though TypeScript infers)
- Examples in documentation

```typescript
/**
 * Create a fully configured MCP server with GoClaw tools.
 *
 * @param config Configuration object
 * @returns Configured McpServer instance
 *
 * @example
 * const config = loadConfig();
 * const server = createServer(config);
 * const transport = new StdioServerTransport();
 * await server.connect(transport);
 */
export function createServer(config: Config): McpServer {
  // ...
}
```

---

## Code Style

### Formatting

- **Indentation:** 2 spaces (configured in editor)
- **Line length:** Soft 100 chars, hard 120 chars
- **Quotes:** Double quotes (`"`) for strings
- **Semicolons:** Always use semicolons
- **Trailing commas:** Use in multiline structures

### Import Organization

```typescript
// 1. External packages (alphabetical)
import { createServer as createHttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// 2. Internal modules (relative paths)
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

// 3. Types (at end)
import type { Config } from "./config.js";
```

**Rules:**
- Always use file extensions (`.js` for imports even if importing `.ts`)
- Group by source: Node.js, external packages, internal
- Alphabetical within groups
- Type imports can be inline or separate

### Export Organization

```typescript
// Interface definition
export interface HttpClientOptions {
  baseUrl: string;
  token?: string;
}

// Main class/function
export class HttpClient {
  // ...
}

// Helper exports at end
export function handleError(err: unknown): string {
  // ...
}
```

---

## Specific Patterns

### Tool Registration

```typescript
export function registerAgentTools(server: McpServer, client: GoClawClient): void {
  // One tool per server.tool() call
  // Keep handler focused and short (delegate to client)

  server.tool(
    "goclaw_agent_list",
    "List all GoClaw agents",
    {}, // No parameters for this tool
    async () => {
      try {
        const agents = await client.agents.listAgents();
        if (!agents.length) {
          return { content: [{ type: "text", text: "No agents configured." }] };
        }
        const text = agents
          .map((a) => `- **${a.display_name}** (${a.agent_key})`)
          .join("\n");
        return { content: [{ type: "text", text: text }] };
      } catch (err) {
        return handleToolError(err);
      }
    }
  );
}
```

### HTTP Request Method

```typescript
async request<T>(method: string, path: string, body?: unknown): Promise<T> {
  // 1. Check circuit breaker
  this.checkCircuit();

  // 2. Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (this.token) {
    headers["Authorization"] = `Bearer ${this.token}`;
  }

  // 3. Retry loop
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, { /* ... */ });
      // Handle response
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new GoClawError(0, "Max retries exceeded", {}, true);
    }
  }
}
```

### Endpoint Module

```typescript
export function agentEndpoints(http: HttpClient) {
  return {
    listAgents: () => http.get<Agent[]>("/agents"),

    getAgent: (agentId: string) =>
      http.get<Agent>(`/agents/${agentId}`),

    createAgent: (body: CreateAgentRequest) =>
      http.post<Agent>("/agents", body),

    deleteAgent: (agentId: string) =>
      http.del(`/agents/${agentId}`),
  };
}
```

---

## Build & Distribution

### Build Output

```bash
pnpm build
# Outputs to dist/
# dist/index.js — stdio entry (require-able via npx)
# dist/http.js — HTTP entry
# dist/*.d.ts — TypeScript declarations
```

### Published Package

```json
{
  "name": "goclaw-mcp",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "goclaw-mcp": "./dist/index.js",
    "goclaw-mcp-http": "./dist/http.js"
  },
  "files": ["dist"]
}
```

**Usage after npm publish:**
```bash
npx goclaw-mcp          # stdio
GOCLAW_MCP_PORT=3100 npx goclaw-mcp-http  # HTTP
```

---

## Development Workflow

### Local Development

```bash
# Install dependencies
pnpm install

# Type check (no emit)
pnpm lint

# Build
pnpm build

# Run tests
pnpm test
pnpm test:watch  # Watch mode

# Watch rebuild
pnpm dev
```

### Before Committing

```bash
# 1. Type check
pnpm lint

# 2. Build
pnpm build

# 3. Run tests
pnpm test

# 4. Review git diff
git diff

# 5. Commit with conventional format
git commit -m "feat: add new tool for X"
```

### Commit Message Format

**Conventional Commits:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation
- `refactor` — Code reorganization (no behavior change)
- `test` — Adding or updating tests
- `chore` — Dependencies, build config (don't use for docs changes)

**Examples:**
```
feat(tools): add goclaw_memory_create tool
fix(http): handle session cleanup on disconnect
docs: update deployment guide
refactor(client): extract retry logic to helper
test(rate-limiter): add burst test case
```

---

## Linting & Formatting

### Current Configuration

- **TypeScript:** `strict: true` (tsc --noEmit)
- **No external linter:** Rely on TS strict mode for quality
- **No code formatter:** Developers format manually per this guide
- **Future:** Consider Prettier/ESLint if team grows

### Type Checking Pre-commit

```bash
# In CI/CD
pnpm lint  # tsc --noEmit
pnpm build # tsup
pnpm test  # vitest
```

---

## Performance Considerations

### Memory

- **Avoid large string concatenation** — Use array.join()
- **Cache regex patterns** — Don't recreate in loops
- **Stream large responses** — Chunked JSON if possible
- **Rate limiter cleanup** — Periodic removal of stale buckets

### Network

- **Reuse HTTP connections** — fetch() default behavior
- **Connection timeout:** 30s hard limit
- **Retry backoff:** Exponential, capped at 5s
- **Circuit breaker:** Prevent thundering herd

### CPU

- **Zod parsing:** Happens per tool call, acceptable cost
- **JSON serialization:** Use native `JSON.stringify()`
- **No heavy computation:** Delegate to GoClaw

---

## Security Best Practices

### Input

- **Always validate** via Zod schemas
- **Reject unexpected fields** (strict parsing)
- **Size limits** on request bodies (1MB HTTP)
- **Type checks** prevent injection

### Secrets

- **Never hardcode** tokens, keys, passwords
- **Environment variables only** for secrets
- **Scrub in logs** before output
- **No secret in error responses** to client

### Output

- **JSON escape** all user-controlled content
- **MIME types** correctly set (application/json)
- **No information leakage** (errors don't reveal infrastructure)

---

## Known Codebase Patterns

### Module Initialization

```typescript
// Modules export factory functions taking dependencies
export function systemEndpoints(http: HttpClient) {
  return {
    health: () => http.get<HealthStatus>("/health"),
    status: () => http.get<Status>("/status"),
  };
}

// Client aggregates these
export class GoClawClient {
  public system: ReturnType<typeof systemEndpoints>;

  constructor(options: GoClawClientOptions) {
    this.http = new HttpClient(options);
    this.system = systemEndpoints(this.http);
  }
}
```

**Pattern:** Factory functions over classes for endpoint modules.

### Tool Handler Template

```typescript
server.tool("goclaw_<domain>_<action>", "Description", schema, async (params) => {
  try {
    const result = await client.<domain>.<action>(params);
    return {
      content: [
        { type: "text", text: formatOutput(result) },
      ],
    };
  } catch (err) {
    return handleToolError(err);
  }
});
```

---

**Last Updated:** 2026-03-15
**Version:** 1.0
