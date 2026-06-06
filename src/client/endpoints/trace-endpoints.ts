/** Trace endpoints: list, detail */

import type { HttpClient } from "../http-client.js";
import type { Trace, TraceDetail } from "../types.js";

export function traceEndpoints(http: HttpClient) {
  return {
    listTraces: async (params?: { agent_id?: string; limit?: number; status?: string }) => {
      const qs = new URLSearchParams();
      if (params?.agent_id) qs.set("agent_id", params.agent_id);
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.status) qs.set("status", params.status);
      const query = qs.toString();
      const r = await http.get<any>(`/v1/traces${query ? `?${query}` : ""}`);
      return (r?.traces ?? []) as Trace[];
    },
    getTrace: (traceId: string) => http.get<TraceDetail>(`/v1/traces/${traceId}`),
  };
}
