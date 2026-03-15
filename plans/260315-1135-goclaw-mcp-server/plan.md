# GoClaw MCP Server — Implementation Plan

**Created:** 2026-03-15
**Status:** Draft
**Priority:** High

## Overview

MCP server wrapping GoClaw Gateway's HTTP REST + WebSocket APIs, enabling AI assistants (Claude, Cursor, etc.) to manage GoClaw infrastructure via standard MCP protocol.

**Target audience:** Enterprise teams running GoClaw as their AI gateway.

## Architecture Summary

```
MCP Client (Claude/Cursor/etc.)
        │
        ├─ stdio (local dev)
        └─ Streamable HTTP (production, multi-client)
              │
    ┌─────────┴──────────┐
    │  GoClaw MCP Server │
    │  (TypeScript/Node)  │
    │                     │
    │  ┌───────────────┐  │
    │  │ Tool Registry  │  │
    │  │ Resource Reg.  │  │
    │  │ Prompt Reg.    │  │
    │  └───────┬───────┘  │
    │          │           │
    │  ┌───────┴───────┐  │
    │  │ GoClaw Client │  │  ← HTTP REST + WebSocket
    │  │ (API Adapter)  │  │
    │  └───────┬───────┘  │
    │          │           │
    │  ┌───────┴───────┐  │
    │  │ Auth + Audit  │  │
    │  └───────────────┘  │
    └─────────┬──────────┘
              │
    ┌─────────┴──────────┐
    │   GoClaw Gateway    │
    │  (Go, PostgreSQL)   │
    └────────────────────┘
```

## Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Language | TypeScript | Best MCP SDK support, type safety |
| Runtime | Node.js 20+ | LTS, stable |
| MCP SDK | `@modelcontextprotocol/sdk` v1.x | Production-recommended |
| Schema Validation | Zod 3 | MCP SDK peer dependency |
| HTTP Client | `undici` (built-in fetch) | Zero-dep, performant |
| Build | `tsup` | Fast, zero-config bundler |
| Package Manager | `pnpm` | Fast, disk-efficient |

## Transports

| Transport | Use Case | Auth |
|-----------|----------|------|
| **stdio** | Local dev, Claude Code, Cursor | Env var `GOCLAW_TOKEN` |
| **Streamable HTTP** | Production, multi-client | Bearer token header |

**Note:** SSE (legacy) is subsumed by Streamable HTTP which supports SSE streaming natively.

## Security Model

GoClaw uses a **trusted subsystem** model — no OAuth. Auth via:
- `Authorization: Bearer <token>` — determines RBAC role (admin/operator/viewer)
- `X-GoClaw-User-Id` — multi-tenant user scoping

MCP server passes these through. Enterprise security additions:
- Input validation (Zod schemas on all tool params)
- Audit logging (structured JSON, who/what/when)
- Rate limiting (per-session for HTTP transport)
- Origin validation (DNS rebinding prevention)
- HTTPS enforcement in production
- No secret logging (token scrubbing)

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | Project setup & scaffolding | Pending | S |
| 2 | GoClaw API client | Pending | M |
| 3 | Core MCP tools (agents, sessions, config) | Pending | L |
| 4 | Extended MCP tools (providers, MCP, skills, tools, cron) | Pending | L |
| 5 | MCP resources & prompts | Pending | M |
| 6 | Security hardening & audit | Pending | M |
| 7 | Testing & documentation | Pending | M |

## Dependencies

- GoClaw Gateway running (local or remote)
- Node.js 20+
- `@modelcontextprotocol/sdk` v1.x

## Blocked By / Blocks

- No blocking dependencies on other plans.

## Key Decisions

1. **v1.x SDK** over v2 pre-alpha — stability for enterprise
2. **No OAuth** — GoClaw doesn't use it; token passthrough instead
3. **Thin wrapper** — MCP server delegates to GoClaw API, no business logic duplication
4. **Modular tool registration** — each domain (agents, sessions, etc.) in separate file
5. **Dual transport from day 1** — stdio + Streamable HTTP, same tool registry
