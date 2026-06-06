/**
 * Tool registration — imports all domain tool modules and registers them.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GoClawClient } from "../client/index.js";
import { registerSystemTools } from "./register-system-tools.js";
import { registerAgentTools } from "./register-agent-tools.js";
import { registerSessionTools } from "./register-session-tools.js";
import { registerProviderTools } from "./register-provider-tools.js";
import { registerMcpServerTools } from "./register-mcp-server-tools.js";
import { registerSkillTools } from "./register-skill-tools.js";
import { registerTraceTools } from "./register-trace-tools.js";
import { registerChannelTools } from "./register-channel-tools.js";
import { registerMemoryTools } from "./register-memory-tools.js";
import { logger } from "../lib/logger.js";

// NOTE: config/cron/team/custom-tool domains are disabled — those routes are
// either WebSocket-only or return 404 on the live gateway (verified 6-Jun).

export function registerAllTools(server: McpServer, client: GoClawClient): void {
  registerSystemTools(server, client);
  registerAgentTools(server, client);
  registerSessionTools(server, client);
  registerProviderTools(server, client);
  registerMcpServerTools(server, client);
  registerSkillTools(server, client);
  registerTraceTools(server, client);
  registerChannelTools(server, client);
  registerMemoryTools(server, client);
  logger.info("All MCP tools registered");
}
