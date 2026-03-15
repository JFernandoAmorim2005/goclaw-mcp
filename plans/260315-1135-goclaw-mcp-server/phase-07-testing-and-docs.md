# Phase 7 — Testing & Documentation

**Priority:** Medium
**Status:** Pending
**Effort:** M (Medium)

## Overview

Unit tests, integration tests, and project documentation (README, usage guide, .env docs).

## Requirements

### Testing
- Unit tests for: config loader, HTTP client, secret scrubber, rate limiter, error mapping
- Integration tests for: tool handlers against mock GoClaw API
- Use `vitest` (fast, ESM-native, TypeScript)
- Mock GoClaw API with `msw` (Mock Service Worker)

### Documentation
- `README.md` with: overview, quickstart, configuration, usage examples
- `.env.example` with all env vars documented
- MCP client config examples (Claude Code, Cursor, etc.)

## Architecture

```
tests/
├── unit/
│   ├── config.test.ts
│   ├── http-client.test.ts
│   ├── secret-scrubber.test.ts
│   ├── rate-limiter.test.ts
│   └── error-mapping.test.ts
├── integration/
│   ├── setup.ts              # MSW server setup
│   ├── handlers.ts           # Mock GoClaw API handlers
│   ├── agent-tools.test.ts
│   ├── session-tools.test.ts
│   └── config-tools.test.ts
└── vitest.config.ts
```

## Implementation Steps

1. Install test deps:
   ```bash
   pnpm add -D vitest msw @types/node
   ```

2. Create `vitest.config.ts` with TypeScript + ESM support

3. Unit tests:
   - `config.test.ts`: env var parsing, defaults, validation errors
   - `http-client.test.ts`: retry logic, timeout, circuit breaker, error mapping
   - `secret-scrubber.test.ts`: all 11+ patterns scrubbed correctly
   - `rate-limiter.test.ts`: token bucket fill/drain, burst, cleanup
   - `error-mapping.test.ts`: GoClaw errors → MCP errors

4. Integration tests:
   - Set up MSW to mock GoClaw API endpoints
   - Test tool handlers return correct formatted output
   - Test error cases (404, 401, 500)
   - Test validation (invalid params rejected)

5. Documentation:
   - `README.md`: overview, install, quickstart, config reference, transport options
   - MCP client config snippets:
     ```json
     // Claude Code (~/.claude.json)
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
   - HTTP deployment guide (Docker, systemd)

6. Add `"scripts"` to package.json:
   ```json
   {
     "test": "vitest run",
     "test:watch": "vitest",
     "test:coverage": "vitest run --coverage"
   }
   ```

## Todo

- [ ] Vitest setup
- [ ] Unit tests: config
- [ ] Unit tests: HTTP client
- [ ] Unit tests: secret scrubber
- [ ] Unit tests: rate limiter
- [ ] Unit tests: error mapping
- [ ] Integration test setup (MSW)
- [ ] Integration tests: agent tools
- [ ] Integration tests: session tools
- [ ] Integration tests: config tools
- [ ] README.md
- [ ] .env.example (comprehensive)
- [ ] MCP client config examples
- [ ] Docker deployment guide

## Success Criteria

- `pnpm test` passes all tests
- >80% code coverage on `src/lib/` and `src/client/`
- README has working quickstart that a developer can follow
- MCP Inspector can connect using documented config

## Next Steps

→ Ship v1.0.0 to npm as `goclaw-mcp`
