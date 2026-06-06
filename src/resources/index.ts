/**
 * Resource registration — read-only data sources for LLM context.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GoClawClient } from "../client/index.js";
import { handleToolError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export function registerAllResources(server: McpServer, client: GoClawClient): void {
  // Gateway status — root "GET /" returns {service,status,protocol,endpoints}
  server.resource("goclaw://status", "Gateway status summary", async () => {
    try {
      const r = (await client.system.root()) as any;
      const text = [
        `GoClaw service: ${r.service ?? "goclaw"}`,
        `Status: ${r.status}`,
        `Protocol: ${r.protocol}`,
        `Endpoints: ${(r.endpoints ?? []).join(", ")}`,
      ].join("\n");
      return {
        contents: [{ uri: "goclaw://status", mimeType: "text/plain", text }],
      };
    } catch {
      return { contents: [{ uri: "goclaw://status", mimeType: "text/plain", text: "Unable to fetch status." }] };
    }
  });

  // Agent list
  server.resource("goclaw://agents", "All agents summary", async () => {
    try {
      const agents = await client.agents.listAgents();
      const text = agents
        .map((a) => `${a.display_name} (${a.agent_key}) — ${a.provider}/${a.model} [${a.agent_type}]`)
        .join("\n");
      return {
        contents: [
          { uri: "goclaw://agents", mimeType: "text/plain", text: text || "No agents configured." },
        ],
      };
    } catch {
      return { contents: [{ uri: "goclaw://agents", mimeType: "text/plain", text: "Unable to fetch agents." }] };
    }
  });

  logger.info("All MCP resources registered");
}
