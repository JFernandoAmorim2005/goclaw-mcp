/** Trace tools: list, detail */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GoClawClient } from "../client/index.js";
import { handleToolError } from "../lib/errors.js";

export function registerTraceTools(server: McpServer, client: GoClawClient): void {
  server.tool(
    "goclaw_trace_list",
    "List LLM execution traces with cost and token usage",
    {
      agent_id: z.string().optional().describe("Filter by agent ID"),
      limit: z.number().optional().describe("Max results (default: 20)"),
      status: z.string().optional().describe("Filter by status (success, error)"),
    },
    async (params) => {
      try {
        const traces = await client.traces.listTraces(params);
        if (!traces.length) return { content: [{ type: "text", text: "No traces found." }] };
        const text = traces
          .map((t) => {
            const ta = t as any;
            return `- \`${ta.id}\` [${ta.status}] — ${ta.name ?? ""} | in: ${ta.total_input_tokens ?? 0} out: ${ta.total_output_tokens ?? 0} | cost: $${ta.total_cost ?? 0} | ${ta.created_at}`;
          })
          .join("\n");
        return { content: [{ type: "text", text: `**Traces**\n${text}` }] };
      } catch (err) {
        return handleToolError(err);
      }
    }
  );

  server.tool(
    "goclaw_trace_get",
    "Get detailed trace with individual LLM call spans",
    { trace_id: z.string().describe("Trace ID") },
    async ({ trace_id }) => {
      try {
        const resp = (await client.traces.getTrace(trace_id)) as any;
        const tr = resp.trace ?? resp;
        const spanList: any[] = resp.spans ?? [];
        const spans = spanList
          .map(
            (s) =>
              `  - ${s.name} (${s.provider ?? "?"}/${s.model ?? "?"}) [${s.status}] — ${s.duration_ms}ms`
          )
          .join("\n");
        const text = [
          `**Trace ${tr.id ?? trace_id}** [${tr.status}]`,
          `- Tokens: in=${tr.total_input_tokens ?? 0} out=${tr.total_output_tokens ?? 0}`,
          `- Cost: $${tr.total_cost ?? 0}`,
          `- Spans (${spanList.length}):\n${spans}`,
        ].join("\n");
        return { content: [{ type: "text", text }] };
      } catch (err) {
        return handleToolError(err);
      }
    }
  );
}
