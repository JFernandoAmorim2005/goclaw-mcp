# Phase 5 — MCP Resources & Prompts

**Priority:** Medium
**Status:** Pending
**Effort:** M (Medium)

## Overview

Define MCP resources (read-only data for context) and prompts (reusable interaction templates) to complement tools.

## Key Insights

- Resources = read-only context data LLMs can load without tool calls
- Prompts = pre-built conversation starters for common GoClaw workflows
- Resources use URI scheme: `goclaw://` prefix
- Resources should be lightweight — summaries, not full data dumps

## Architecture

```
src/resources/
├── index.ts              # registerAllResources()
├── register-agent-resources.ts
├── register-config-resources.ts
└── register-system-resources.ts

src/prompts/
├── index.ts              # registerAllPrompts()
└── register-gateway-prompts.ts
```

## Resource Definitions

### System Resources

| URI | Description | MIME |
|-----|-------------|------|
| `goclaw://status` | Gateway status summary | text/plain |
| `goclaw://models` | Available LLM models list | text/plain |

### Agent Resources

| URI | Description | MIME |
|-----|-------------|------|
| `goclaw://agents` | All agents summary (name, model, status) | text/plain |
| `goclaw://agents/{id}` | Single agent details | text/plain |
| `goclaw://agents/{id}/files` | Agent context files listing | text/plain |
| `goclaw://agents/{id}/files/{path}` | Specific context file content | text/plain |

### Config Resources

| URI | Description | MIME |
|-----|-------------|------|
| `goclaw://config` | Current gateway configuration | application/json |
| `goclaw://config/schema` | Configuration JSON schema | application/json |

## Prompt Definitions

### Gateway Management Prompts

| Prompt Name | Description | Arguments |
|------------|-------------|-----------|
| `goclaw_setup_agent` | Guide through creating and configuring a new agent | `agent_purpose: string` |
| `goclaw_troubleshoot` | Systematic troubleshooting of gateway issues | `symptom: string` |
| `goclaw_review_config` | Review current config for issues/improvements | none |
| `goclaw_optimize_agent` | Suggest optimizations for an agent's settings | `agent_id: string` |

## Implementation Steps

1. Create resource registration modules
2. For dynamic resources (agents), use resource templates:
   ```typescript
   server.resource(
     "goclaw://agents",
     { name: "Agent List", mimeType: "text/plain" },
     async () => {
       const agents = await client.listAgents();
       return { text: formatAgentList(agents) };
     }
   );
   ```
3. Create prompt registration modules
4. For prompts with arguments:
   ```typescript
   server.prompt(
     "goclaw_setup_agent",
     {
       description: "Guide through creating a new GoClaw agent",
       arguments: [
         { name: "agent_purpose", description: "What the agent should do", required: true },
       ],
     },
     async ({ agent_purpose }) => ({
       messages: [{
         role: "user",
         content: { type: "text", text: `Help me create a GoClaw agent for: ${agent_purpose}\n\nPlease:\n1. Suggest an agent_key and display_name\n2. Recommend provider/model based on the purpose\n3. Suggest appropriate tool permissions\n4. Draft the IDENTITY.md context file\n5. Create the agent using goclaw_agent_create` },
       }],
     })
   );
   ```
5. Wire into `src/server.ts`
6. Test via MCP Inspector

## Todo

- [ ] System resources
- [ ] Agent resources (list + template)
- [ ] Config resources
- [ ] Gateway management prompts
- [ ] Wire into server factory
- [ ] Test all resources and prompts

## Success Criteria

- Resources readable via MCP Inspector
- Dynamic resources (agents) reflect live state
- Prompts generate useful conversation starters
- Resource notifications fire on changes (tools/list_changed)

## Next Steps

→ Phase 6: Security Hardening
