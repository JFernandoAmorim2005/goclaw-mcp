# Phase 3 — Core MCP Tools (Agents, Sessions, Config)

**Priority:** Critical
**Status:** Pending
**Effort:** L (Large)

## Overview

Register MCP tools for the three most important GoClaw domains: agents, sessions, and configuration. These are the operations AI assistants will use most frequently.

## Key Insights

- MCP tools = executable functions AI can call
- Each tool needs: name, description, Zod input schema, handler function
- Tool names should be namespaced: `goclaw_agent_list`, `goclaw_session_list`, etc.
- Descriptions must be clear enough for LLMs to choose the right tool
- Return structured text (not raw JSON) for LLM readability

## Requirements

### Functional
- Agent management tools (CRUD + files + links + shares)
- Session management tools (list, preview, delete, reset)
- Config management tools (get, apply, patch)
- System tools (health, status, models)

### Non-Functional
- All inputs validated via Zod before API call
- Errors returned as MCP error content (not thrown)
- Tool output formatted for LLM consumption (markdown-ish text)

## Architecture

```
src/tools/
├── index.ts              # registerAllTools() — imports all modules
├── register-system-tools.ts
├── register-agent-tools.ts
├── register-session-tools.ts
└── register-config-tools.ts
```

Each module exports a function: `(server: McpServer, client: GoClawClient) => void`

## Tool Definitions

### System Tools

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `goclaw_health` | Check GoClaw gateway health | none |
| `goclaw_status` | Get gateway status (version, uptime, connections) | none |
| `goclaw_models_list` | List available LLM models | none |

### Agent Tools

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `goclaw_agent_list` | List all agents | `include_deleted?: bool` |
| `goclaw_agent_get` | Get agent details | `id: string` |
| `goclaw_agent_create` | Create a new agent | `agent_key, display_name, provider, model, ...` |
| `goclaw_agent_update` | Update agent settings | `id, ...partial fields` |
| `goclaw_agent_delete` | Delete an agent (soft) | `id: string` |
| `goclaw_agent_files_list` | List agent context files | `agent_id: string` |
| `goclaw_agent_files_get` | Read a context file | `agent_id, path: string` |
| `goclaw_agent_files_set` | Create/update context file | `agent_id, path, content: string` |
| `goclaw_agent_files_delete` | Delete context file | `agent_id, path: string` |
| `goclaw_agent_links_list` | List agent delegation links | `agent_id: string` |
| `goclaw_agent_links_set` | Set delegation link | `agent_id, target_agent_id, description` |
| `goclaw_agent_links_remove` | Remove delegation link | `agent_id, target_agent_id` |
| `goclaw_agent_share` | Share agent with user | `agent_id, user_id, role` |

### Session Tools

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `goclaw_session_list` | List chat sessions | `agent_id?: string, limit?: number` |
| `goclaw_session_preview` | Preview session messages | `session_key: string, limit?: number` |
| `goclaw_session_delete` | Delete a session | `session_key: string` |
| `goclaw_session_reset` | Reset session (clear history) | `session_key: string` |
| `goclaw_session_label` | Set session label | `session_key, label: string` |

### Config Tools

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `goclaw_config_get` | Get current gateway config | `section?: string` |
| `goclaw_config_apply` | Apply full config (overwrites) | `config: object` |
| `goclaw_config_patch` | Patch specific config fields | `patches: object` |

## Implementation Steps

1. Create `src/tools/index.ts`:
   ```typescript
   export function registerAllTools(server: McpServer, client: GoClawClient) {
     registerSystemTools(server, client);
     registerAgentTools(server, client);
     registerSessionTools(server, client);
     registerConfigTools(server, client);
   }
   ```

2. For each tool module, follow this pattern:
   ```typescript
   server.tool(
     "goclaw_agent_list",
     {
       description: "List all agents configured in GoClaw gateway",
       inputSchema: {
         include_deleted: z.boolean().optional().describe("Include soft-deleted agents"),
       },
     },
     async ({ include_deleted }) => {
       try {
         const agents = await client.listAgents({ include_deleted });
         const text = agents.map(a =>
           `- **${a.display_name}** (${a.agent_key}) — ${a.provider}/${a.model} [${a.status}]`
         ).join("\n");
         return { content: [{ type: "text", text: text || "No agents found." }] };
       } catch (err) {
         return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
       }
     }
   );
   ```

3. Implement all system tools (3 tools)
4. Implement all agent tools (13 tools)
5. Implement all session tools (5 tools)
6. Implement all config tools (3 tools)
7. Wire `registerAllTools()` into `src/server.ts` factory
8. Test each tool via MCP Inspector

## Output Formatting Guidelines

- Use markdown-like formatting (bold, lists, code blocks)
- Summarize large payloads (don't dump raw JSON arrays)
- Include actionable info (IDs, names, status)
- For errors: include error code, message, and suggested fix

## Todo

- [ ] Tool registration framework (`src/tools/index.ts`)
- [ ] System tools (health, status, models)
- [ ] Agent CRUD tools
- [ ] Agent context file tools
- [ ] Agent link tools
- [ ] Agent share tools
- [ ] Session tools
- [ ] Config tools
- [ ] Wire into server factory
- [ ] Test all tools via MCP Inspector

## Success Criteria

- 24 tools registered and callable
- All tools return formatted text (not raw JSON)
- Error cases return `isError: true` with clear messages
- MCP Inspector can discover and invoke all tools
- Tools work against live GoClaw instance

## Next Steps

→ Phase 4: Extended MCP Tools
