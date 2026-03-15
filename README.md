# goclaw-mcp

MCP (Model Context Protocol) server for [GoClaw](https://github.com/nextlevelbuilder/goclaw) Gateway server management. Enables AI assistants like Claude, Cursor, and other MCP clients to manage your GoClaw AI gateway infrastructure.

## Features

- **66 MCP tools** covering all GoClaw management operations
- **4 MCP resources** for real-time gateway context
- **4 MCP prompts** for guided workflows
- **Dual transport**: stdio (local) + Streamable HTTP (production)
- **Enterprise security**: audit logging, rate limiting, secret scrubbing, origin validation
- **Type-safe**: Full TypeScript with Zod schema validation

## Quick Start

### stdio (Claude Code, Cursor, etc.)

```bash
npx goclaw-mcp
```

Add to your MCP client config:

**Claude Code** (`~/.claude.json`):
```json
{
  "mcpServers": {
    "goclaw": {
      "command": "npx",
      "args": ["goclaw-mcp"],
      "env": {
        "GOCLAW_SERVER": "http://localhost:8080",
        "GOCLAW_TOKEN": "your-admin-token"
      }
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "goclaw": {
      "command": "npx",
      "args": ["goclaw-mcp"],
      "env": {
        "GOCLAW_SERVER": "http://localhost:8080",
        "GOCLAW_TOKEN": "your-admin-token"
      }
    }
  }
}
```

### Streamable HTTP (production, multi-client)

```bash
GOCLAW_SERVER=http://localhost:8080 \
GOCLAW_TOKEN=your-token \
GOCLAW_MCP_PORT=3100 \
npx goclaw-mcp-http
```

MCP endpoint: `http://localhost:3100/mcp`

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOCLAW_SERVER` | Yes | — | GoClaw gateway URL |
| `GOCLAW_TOKEN` | No | — | Bearer token (determines RBAC role) |
| `GOCLAW_USER_ID` | No | — | Default user ID for multi-tenant scoping |
| `GOCLAW_MCP_PORT` | No | `3100` | HTTP transport port |
| `GOCLAW_MCP_ALLOWED_ORIGINS` | No | `localhost` | Comma-separated allowed origins |
| `GOCLAW_MCP_RATE_LIMIT_RPM` | No | `60` | Rate limit per session (req/min) |
| `GOCLAW_LOG_LEVEL` | No | `info` | Log level: debug, info, warn, error |

## Available Tools

### System (3)
| Tool | Description |
|------|-------------|
| `goclaw_health` | Check gateway health |
| `goclaw_status` | Get gateway status |
| `goclaw_models_list` | List available LLM models |

### Agents (13)
| Tool | Description |
|------|-------------|
| `goclaw_agent_list` | List all agents |
| `goclaw_agent_get` | Get agent details |
| `goclaw_agent_create` | Create agent |
| `goclaw_agent_update` | Update agent |
| `goclaw_agent_delete` | Delete agent |
| `goclaw_agent_files_list` | List context files |
| `goclaw_agent_files_get` | Read context file |
| `goclaw_agent_files_set` | Write context file |
| `goclaw_agent_files_delete` | Delete context file |
| `goclaw_agent_links_list` | List delegation links |
| `goclaw_agent_links_set` | Set delegation link |
| `goclaw_agent_links_remove` | Remove delegation link |
| `goclaw_agent_share` | Share agent with user |

### Sessions (5)
| Tool | Description |
|------|-------------|
| `goclaw_session_list` | List chat sessions |
| `goclaw_session_preview` | Preview session messages |
| `goclaw_session_delete` | Delete session |
| `goclaw_session_reset` | Reset session history |
| `goclaw_session_label` | Label a session |

### Configuration (3)
| Tool | Description |
|------|-------------|
| `goclaw_config_get` | Get gateway config |
| `goclaw_config_apply` | Apply full config |
| `goclaw_config_patch` | Patch config fields |

### Providers (5)
| Tool | Description |
|------|-------------|
| `goclaw_provider_list` | List LLM providers |
| `goclaw_provider_get` | Get provider details |
| `goclaw_provider_create` | Add provider |
| `goclaw_provider_update` | Update provider |
| `goclaw_provider_delete` | Remove provider |

### MCP Servers (7)
| Tool | Description |
|------|-------------|
| `goclaw_mcp_server_list` | List registered MCP servers |
| `goclaw_mcp_server_get` | Get MCP server details |
| `goclaw_mcp_server_create` | Register MCP server |
| `goclaw_mcp_server_update` | Update MCP server |
| `goclaw_mcp_server_delete` | Remove MCP server |
| `goclaw_mcp_server_grant_agent` | Grant agent access |
| `goclaw_mcp_server_grant_user` | Grant user access |

### Skills (5)
| Tool | Description |
|------|-------------|
| `goclaw_skill_list` | List skills |
| `goclaw_skill_get` | Get skill details |
| `goclaw_skill_update` | Update skill |
| `goclaw_skill_grant_agent` | Grant agent access |
| `goclaw_skill_grant_user` | Grant user access |

### Custom Tools (6)
| Tool | Description |
|------|-------------|
| `goclaw_custom_tool_list` | List custom tools |
| `goclaw_custom_tool_get` | Get tool details |
| `goclaw_custom_tool_create` | Create custom tool |
| `goclaw_custom_tool_update` | Update custom tool |
| `goclaw_custom_tool_delete` | Delete custom tool |
| `goclaw_custom_tool_invoke` | Invoke tool directly |

### Cron Jobs (6)
| Tool | Description |
|------|-------------|
| `goclaw_cron_list` | List cron jobs |
| `goclaw_cron_create` | Create cron job |
| `goclaw_cron_update` | Update cron job |
| `goclaw_cron_delete` | Delete cron job |
| `goclaw_cron_toggle` | Enable/disable cron |
| `goclaw_cron_run` | Trigger cron immediately |

### Teams (5)
| Tool | Description |
|------|-------------|
| `goclaw_team_list` | List teams |
| `goclaw_team_get` | Get team details |
| `goclaw_team_create` | Create team |
| `goclaw_team_update` | Update team |
| `goclaw_team_delete` | Delete team |

### Traces (2)
| Tool | Description |
|------|-------------|
| `goclaw_trace_list` | List LLM execution traces |
| `goclaw_trace_get` | Get trace with spans |

### Channels (2)
| Tool | Description |
|------|-------------|
| `goclaw_channel_list` | List messaging channels |
| `goclaw_channel_toggle` | Enable/disable channel |

### Memory (4)
| Tool | Description |
|------|-------------|
| `goclaw_memory_list` | List memory documents |
| `goclaw_memory_get` | Read memory document |
| `goclaw_memory_create` | Store memory document |
| `goclaw_memory_delete` | Delete memory document |

## Resources

| URI | Description |
|-----|-------------|
| `goclaw://status` | Gateway status summary |
| `goclaw://models` | Available LLM models |
| `goclaw://agents` | All agents summary |
| `goclaw://config` | Current gateway config |

## Prompts

| Prompt | Description |
|--------|-------------|
| `goclaw_setup_agent` | Guide through creating a new agent |
| `goclaw_troubleshoot` | Systematic troubleshooting |
| `goclaw_review_config` | Review config for improvements |
| `goclaw_optimize_agent` | Optimize agent settings |

## Security

Built for enterprise environments:

- **Secret scrubbing** — Tokens, API keys, passwords never appear in logs
- **Audit logging** — Every tool invocation logged with structured JSON
- **Rate limiting** — Token bucket per session (HTTP transport)
- **Origin validation** — DNS rebinding prevention
- **Input validation** — Zod schemas on all tool parameters
- **Auth passthrough** — Bearer token forwarded to GoClaw RBAC

## Development

```bash
# Install
pnpm install

# Build
pnpm build

# Test
pnpm test

# Type check
pnpm lint

# Dev mode (watch)
pnpm dev
```

## License

MIT
