/** Agent endpoints: CRUD, shares.
 * NOTE: context-files (/v1/agents/{id}/files) and links (/v1/agents/{id}/links)
 * do not exist on the live gateway (404, verified 6-Jun) — removed. */

import type { HttpClient } from "../http-client.js";
import type {
  Agent,
  CreateAgentRequest,
  UpdateAgentRequest,
  GrantRequest,
} from "../types.js";

export function agentEndpoints(http: HttpClient) {
  return {
    listAgents: async (params?: { include_deleted?: boolean }) => {
      const qs = params?.include_deleted ? "?include_deleted=true" : "";
      const r = await http.get<any>(`/v1/agents${qs}`);
      return (r?.agents ?? []) as Agent[];
    },
    getAgent: (id: string) => http.get<Agent>(`/v1/agents/${id}`),
    createAgent: (data: CreateAgentRequest) => http.post<Agent>("/v1/agents", data),
    updateAgent: (id: string, data: UpdateAgentRequest) =>
      http.put<Agent>(`/v1/agents/${id}`, data),
    deleteAgent: (id: string) => http.del(`/v1/agents/${id}`),

    // Shares
    shareAgent: (agentId: string, grant: GrantRequest) =>
      http.post(`/v1/agents/${agentId}/shares`, grant),
  };
}
