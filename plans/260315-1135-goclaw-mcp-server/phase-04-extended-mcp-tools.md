# Phase 4 — Extended MCP Tools (Providers, MCP, Skills, Custom Tools, Cron)

**Priority:** High
**Status:** Pending
**Effort:** L (Large)

## Overview

Register MCP tools for remaining GoClaw domains: LLM providers, MCP server management, skills, custom tools, cron jobs, teams, traces, channels, and memory.

## Architecture

```
src/tools/
├── ... (Phase 3 files)
├── register-provider-tools.ts
├── register-mcp-server-tools.ts
├── register-skill-tools.ts
├── register-custom-tool-tools.ts
├── register-cron-tools.ts
├── register-team-tools.ts
├── register-trace-tools.ts
├── register-channel-tools.ts
└── register-memory-tools.ts
```

## Tool Definitions

### Provider Tools (P1)

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `goclaw_provider_list` | List LLM providers | none |
| `goclaw_provider_get` | Get provider details | `id: string` |
| `goclaw_provider_create` | Add LLM provider | `name, type, api_key, base_url?, models?` |
| `goclaw_provider_update` | Update provider | `id, ...partial` |
| `goclaw_provider_delete` | Remove provider | `id: string` |

### MCP Server Management Tools (P1)

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `goclaw_mcp_server_list` | List registered MCP servers | none |
| `goclaw_mcp_server_get` | Get MCP server details | `id: string` |
| `goclaw_mcp_server_create` | Register MCP server | `name, transport, command/url, args?, env?` |
| `goclaw_mcp_server_update` | Update MCP server config | `id, ...partial` |
| `goclaw_mcp_server_delete` | Remove MCP server | `id: string` |
| `goclaw_mcp_server_grant_agent` | Grant agent access to MCP server | `server_id, agent_id` |
| `goclaw_mcp_server_grant_user` | Grant user access to MCP server | `server_id, user_id` |

### Skill Tools (P1)

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `goclaw_skill_list` | List available skills | none |
| `goclaw_skill_get` | Get skill details | `id: string` |
| `goclaw_skill_update` | Update skill metadata | `id, ...partial` |
| `goclaw_skill_grant_agent` | Grant agent access to skill | `skill_id, agent_id` |
| `goclaw_skill_grant_user` | Grant user access to skill | `skill_id, user_id` |

### Custom Tool Tools (P1)

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `goclaw_custom_tool_list` | List custom tools | `agent_id?: string` |
| `goclaw_custom_tool_get` | Get custom tool details | `id: string` |
| `goclaw_custom_tool_create` | Create custom tool | `name, description, parameters, command, timeout?, env?` |
| `goclaw_custom_tool_update` | Update custom tool | `id, ...partial` |
| `goclaw_custom_tool_delete` | Delete custom tool | `id: string` |
| `goclaw_custom_tool_invoke` | Invoke a custom tool directly | `id, args: object` |

### Cron Tools (P1)

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `goclaw_cron_list` | List cron jobs | none |
| `goclaw_cron_create` | Create cron job | `name, expression, agent_id, message, ...` |
| `goclaw_cron_update` | Update cron job | `id, ...partial` |
| `goclaw_cron_delete` | Delete cron job | `id: string` |
| `goclaw_cron_toggle` | Enable/disable cron job | `id, enabled: bool` |
| `goclaw_cron_run` | Trigger cron job immediately | `id: string` |

### Team Tools (P2)

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `goclaw_team_list` | List teams | none |
| `goclaw_team_get` | Get team details | `id: string` |
| `goclaw_team_create` | Create team | `name, description, member_agent_ids` |
| `goclaw_team_update` | Update team | `id, ...partial` |
| `goclaw_team_delete` | Delete team | `id: string` |

### Trace Tools (P2)

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `goclaw_trace_list` | List LLM execution traces | `agent_id?, limit?, status?` |
| `goclaw_trace_get` | Get trace detail with spans | `trace_id: string` |

### Channel Tools (P2)

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `goclaw_channel_list` | List messaging channels | none |
| `goclaw_channel_toggle` | Enable/disable channel | `channel, enabled: bool` |

### Memory Tools (P2)

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `goclaw_memory_list` | List memory documents | `agent_id, user_id?` |
| `goclaw_memory_get` | Get memory document | `id: string` |
| `goclaw_memory_create` | Store memory document | `agent_id, path, content` |
| `goclaw_memory_delete` | Delete memory document | `id: string` |

## Implementation Steps

1. Create each tool registration module following Phase 3 pattern
2. Add imports to `src/tools/index.ts`
3. Implement P1 tools first (providers, MCP servers, skills, custom tools, cron)
4. Implement P2 tools (teams, traces, channels, memory)
5. Test each module via MCP Inspector

## Todo

- [ ] Provider tools (5)
- [ ] MCP server tools (7)
- [ ] Skill tools (5)
- [ ] Custom tool tools (6)
- [ ] Cron tools (6)
- [ ] Team tools (5)
- [ ] Trace tools (2)
- [ ] Channel tools (2)
- [ ] Memory tools (4)
- [ ] Wire all into server factory
- [ ] Test all tools

## Success Criteria

- ~42 additional tools registered (total ~66 tools)
- All tools follow consistent naming/formatting patterns
- P1 tools tested against live GoClaw
- P2 tools tested against live GoClaw

## Next Steps

→ Phase 5: MCP Resources & Prompts
