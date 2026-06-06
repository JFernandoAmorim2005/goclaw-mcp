/** System tools: health.
 * NOTE: goclaw_status (/v1/status) and goclaw_models_list (/v1/models) removed —
 * those routes do not exist on the live gateway. */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GoClawClient } from "../client/index.js";
import { handleToolError } from "../lib/errors.js";

export function registerSystemTools(server: McpServer, client: GoClawClient): void {
  server.tool(
    "goclaw_health",
    "Check GoClaw gateway health status",
    {},
    async () => {
      try {
        const health = (await client.system.health()) as any;
        const root = await client.system.root().catch(() => null as any);
        const lines = [`Gateway Health: ${health.status}`];
        if (health.protocol ?? root?.protocol) lines.push(`Protocol: ${health.protocol ?? root.protocol}`);
        if (root?.endpoints) lines.push(`Endpoints: ${root.endpoints.join(", ")}`);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        return handleToolError(err);
      }
    }
  );
}
