/** Session endpoints: list.
 * NOTE: preview/delete/reset/label are WebSocket-only on the gateway — removed. */

import type { HttpClient } from "../http-client.js";
import type { Session } from "../types.js";

export function sessionEndpoints(http: HttpClient) {
  return {
    listSessions: async (params?: { agent_id?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.agent_id) qs.set("agent_id", params.agent_id);
      if (params?.limit) qs.set("limit", String(params.limit));
      const query = qs.toString();
      const r = await http.get<any>(`/v1/sessions${query ? `?${query}` : ""}`);
      return (r?.sessions ?? []) as Session[];
    },
  };
}
