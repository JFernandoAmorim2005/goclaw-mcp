# Phase 1 — Project Setup & Scaffolding

**Priority:** Critical
**Status:** Pending
**Effort:** S (Small)

## Overview

Initialize TypeScript project with MCP SDK, dual transport entry points, and build pipeline.

## Key Insights

- MCP SDK v1.x is production-recommended; v2 is pre-alpha
- `tsup` bundles to single file for stdio distribution
- Dual transport (stdio + HTTP) shares same server factory

## Requirements

### Functional
- `pnpm` project with TypeScript strict mode
- MCP SDK v1.x + Zod 3 integration
- stdio entry point (`bin/goclaw-mcp`)
- HTTP entry point (`bin/goclaw-mcp-http`)
- Environment-based config (`GOCLAW_SERVER`, `GOCLAW_TOKEN`, etc.)

### Non-Functional
- Build in <5s
- Single-file bundle for stdio distribution
- ESM module format

## Architecture

```
goclaw-mcp/
├── src/
│   ├── index.ts              # stdio entry point
│   ├── http.ts               # Streamable HTTP entry point
│   ├── server.ts             # MCP server factory (shared)
│   ├── config.ts             # Environment config loader
│   ├── client/               # GoClaw API client (Phase 2)
│   │   └── index.ts
│   ├── tools/                # MCP tool definitions (Phase 3-4)
│   │   └── index.ts
│   ├── resources/            # MCP resource definitions (Phase 5)
│   │   └── index.ts
│   ├── prompts/              # MCP prompt definitions (Phase 5)
│   │   └── index.ts
│   └── lib/                  # Shared utilities
│       ├── logger.ts         # Structured JSON logger
│       └── errors.ts         # Error types + formatting
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── .env.example
└── README.md
```

## Related Code Files

### Create
- `package.json` — project manifest
- `tsconfig.json` — TypeScript config (strict, ESM, Node20)
- `tsup.config.ts` — Build config (dual entry points)
- `.env.example` — Environment variable template
- `src/index.ts` — stdio transport entry
- `src/http.ts` — Streamable HTTP entry
- `src/server.ts` — Server factory with tool/resource/prompt registration
- `src/config.ts` — Config from env vars
- `src/lib/logger.ts` — Structured logger (stderr for stdio, stdout for HTTP)
- `src/lib/errors.ts` — GoClaw error types

## Implementation Steps

1. `pnpm init` + set `"type": "module"` in package.json
2. Install deps:
   ```bash
   pnpm add @modelcontextprotocol/sdk zod
   pnpm add -D typescript tsup @types/node
   ```
3. Create `tsconfig.json` with strict mode, ESM, target ES2022, moduleResolution bundler
4. Create `tsup.config.ts` with two entry points (`src/index.ts`, `src/http.ts`), format ESM
5. Create `src/config.ts`:
   - `GOCLAW_SERVER` (required, e.g. `http://localhost:8080`)
   - `GOCLAW_TOKEN` (optional, for admin access)
   - `GOCLAW_USER_ID` (optional, default user context)
   - `GOCLAW_MCP_PORT` (HTTP mode, default 3100)
   - `GOCLAW_LOG_LEVEL` (debug/info/warn/error, default info)
   - Validate required vars, throw clear errors
6. Create `src/lib/logger.ts`: structured JSON to stderr (stdio-safe), levels, no secret leaking
7. Create `src/lib/errors.ts`: `GoClawError` class mapping GoClaw API errors to MCP error responses
8. Create `src/server.ts`: `createServer()` factory that instantiates McpServer, registers all tools/resources/prompts
9. Create `src/index.ts`: stdio transport — `createServer()` → `StdioServerTransport` → `server.connect()`
10. Create `src/http.ts`: Express/Hono app → `StreamableHTTPServerTransport` → route `/mcp` POST/GET/DELETE
11. Add `"bin"` field to package.json for `goclaw-mcp` CLI command
12. Add build + dev scripts to package.json
13. Create `.env.example` with all env vars documented
14. Verify build: `pnpm build` produces working bundles

## Todo

- [ ] Initialize pnpm project
- [ ] Install dependencies
- [ ] TypeScript + tsup config
- [ ] Config loader with validation
- [ ] Logger (structured, stderr-safe)
- [ ] Error types
- [ ] Server factory (empty, ready for tool registration)
- [ ] stdio entry point
- [ ] HTTP entry point
- [ ] Build verification
- [ ] `.env.example`

## Success Criteria

- `pnpm build` succeeds, produces `dist/index.js` and `dist/http.js`
- `node dist/index.js` starts stdio MCP server (responds to `initialize`)
- `GOCLAW_MCP_PORT=3100 node dist/http.js` starts HTTP server on port 3100
- `npx @modelcontextprotocol/inspector` can connect to both transports
- No TypeScript errors in strict mode

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SDK v1.x breaking changes | Low | Med | Pin exact version |
| Streamable HTTP transport API | Low | Med | Follow SDK examples closely |

## Next Steps

→ Phase 2: GoClaw API Client
