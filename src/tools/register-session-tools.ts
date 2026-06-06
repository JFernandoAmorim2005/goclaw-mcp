/** Session tools: list.
 * NOTE: preview/delete/reset/label are WebSocket-only on the gateway — removed. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GoClawClient } from "../client/index.js";
import { handleToolError } from "../lib/errors.js";

export function registerSessionTools(server: McpServer, client: GoClawClient): void {
  server.tool(
    "goclaw_session_list",
    "List chat sessions, optionally filtered by agent",
    {
      agent_id: z.string().optional().describe("Filter by agent ID"),
      limit: z.number().optional().describe("Max results (default: 20)"),
    },
    async ({ agent_id, limit }) => {
      try {
        const sessions = await client.sessions.listSessions({ agent_id, limit });
        if (!sessions.length) return { content: [{ type: "text", text: "No sessions found." }] };
        const text = sessions
          .map((s) => {
            const sa = s as any;
            const toks = (sa.inputTokens ?? 0) + (sa.outputTokens ?? 0);
            return `- \`${sa.key}\` — ${sa.agentName ?? sa.channel ?? ""} | msgs: ${sa.messageCount ?? 0} | tokens: ${toks} | ${sa.updated ?? ""}`;
          })
          .join("\n");
        return { content: [{ type: "text", text: `**Sessions**\n${text}` }] };
      } catch (err) {
        return handleToolError(err);
      }
    }
  );
}
