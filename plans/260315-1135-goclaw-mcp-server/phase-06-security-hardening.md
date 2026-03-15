# Phase 6 — Security Hardening & Audit

**Priority:** High
**Status:** Pending
**Effort:** M (Medium)

## Overview

Enterprise security hardening: input validation, audit logging, rate limiting, origin validation, and secret scrubbing. GoClaw targets enterprise environments — security is non-negotiable.

## Key Insights

- GoClaw already has 5 defense layers server-side; MCP server adds client-side defense
- Token is the only auth mechanism — protect it absolutely
- Audit trail critical for enterprise compliance
- Rate limiting prevents abuse of multi-client HTTP transport

## Architecture

```
src/lib/
├── ... (existing)
├── audit.ts              # Audit logger (who/what/when/result)
├── rate-limiter.ts       # Token bucket rate limiter
├── origin-validator.ts   # DNS rebinding prevention
└── secret-scrubber.ts    # Remove secrets from logs/outputs
```

## Security Requirements

### 1. Input Validation (Already covered by Zod schemas)
- All tool parameters validated before API call
- String length limits on text inputs
- URL validation for server addresses
- ID format validation (UUID where applicable)

### 2. Audit Logging
- Every tool invocation logged:
  ```json
  {
    "timestamp": "2026-03-15T11:35:00Z",
    "level": "info",
    "event": "tool_invoked",
    "tool": "goclaw_agent_create",
    "user_id": "tenant.acme.user.alice",
    "session_id": "mcp-sess-abc123",
    "params": { "agent_key": "helper", "provider": "anthropic" },
    "result": "success",
    "duration_ms": 245
  }
  ```
- Failed attempts logged with error details
- Config changes logged at WARN level
- Destructive ops (delete) logged at WARN level
- **Never** log: tokens, API keys, passwords, file contents

### 3. Rate Limiting (HTTP transport only)
- Token bucket algorithm per session
- Default: 60 requests/minute, burst 10
- Configurable via `GOCLAW_MCP_RATE_LIMIT_RPM`
- Return standard 429 with `Retry-After` header

### 4. Origin Validation (HTTP transport only)
- Validate `Origin` header against allowed list
- Default: `localhost` only
- Configurable via `GOCLAW_MCP_ALLOWED_ORIGINS`
- Block requests with mismatched origins (DNS rebinding prevention)

### 5. Secret Scrubbing
- Scrub from all log output and tool responses:
  - Bearer tokens (`Bearer ...`)
  - API keys (common patterns: `sk-*`, `key-*`, etc.)
  - Connection strings
  - Environment variable values containing "KEY", "SECRET", "TOKEN", "PASSWORD"
- Use regex patterns from GoClaw's credential scrubbing (11+ patterns)

### 6. Transport Security
- HTTP transport: HTTPS enforcement in production (`GOCLAW_MCP_HTTPS=true`)
- Message size limit: 1MB per request
- Session timeout: 30min idle for HTTP sessions
- Graceful shutdown: drain active sessions

## Implementation Steps

1. Create `src/lib/secret-scrubber.ts`:
   - Export `scrub(text: string): string`
   - 11+ regex patterns matching GoClaw's scrubber
   - Apply to all log output and error messages

2. Create `src/lib/audit.ts`:
   - `AuditLogger` class wrapping structured logger
   - Methods: `toolInvoked()`, `toolFailed()`, `configChanged()`, `destructiveOp()`
   - Include session ID, user ID, tool name, sanitized params
   - Output to stderr (stdio) or configurable file/stream (HTTP)

3. Create `src/lib/rate-limiter.ts`:
   - Token bucket implementation (no external deps)
   - Per-session tracking (Map<sessionId, Bucket>)
   - Cleanup stale sessions on interval

4. Create `src/lib/origin-validator.ts`:
   - Parse `GOCLAW_MCP_ALLOWED_ORIGINS` (comma-separated)
   - Default: `["localhost", "127.0.0.1", "::1"]`
   - Middleware for HTTP transport

5. Integrate into server and transports:
   - Wrap tool handlers with audit logging
   - Add rate limiter middleware to HTTP entry point
   - Add origin validation to HTTP entry point
   - Scrub all log/error output

6. Add env vars to config:
   - `GOCLAW_MCP_RATE_LIMIT_RPM` (default: 60)
   - `GOCLAW_MCP_ALLOWED_ORIGINS` (default: localhost)
   - `GOCLAW_MCP_HTTPS` (default: false)
   - `GOCLAW_MCP_AUDIT_LOG` (default: stderr)
   - `GOCLAW_MCP_SESSION_TIMEOUT_MIN` (default: 30)

## Todo

- [ ] Secret scrubber with 11+ patterns
- [ ] Audit logger (structured, per-invocation)
- [ ] Rate limiter (token bucket, per-session)
- [ ] Origin validator (DNS rebinding prevention)
- [ ] HTTP transport middleware integration
- [ ] Config env vars for security settings
- [ ] Audit logging integration in tool handlers
- [ ] HTTPS enforcement mode
- [ ] Session timeout for HTTP
- [ ] Graceful shutdown

## Success Criteria

- No secrets in any log output (verified by pattern scan)
- Every tool invocation produces an audit log entry
- Rate limiter returns 429 after burst exceeded
- Origin validation blocks non-allowed origins
- Security settings configurable via env vars

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Secret leaks in error messages | Med | High | Scrubber on all output paths |
| Rate limiter memory leak | Low | Med | Session cleanup interval |
| Origin bypass via proxy | Low | Med | Document proxy config requirements |

## Next Steps

→ Phase 7: Testing & Documentation
