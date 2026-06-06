/** Memory document endpoints: CRUD */

import type { HttpClient } from "../http-client.js";
import type { MemoryDocument } from "../types.js";

export function memoryEndpoints(http: HttpClient) {
  return {
    listMemoryDocs: async (agentId: string, userId?: string) => {
      const qs = new URLSearchParams({ agent_id: agentId });
      if (userId) qs.set("user_id", userId);
      // /v1/memory/documents returns a bare array
      const r = await http.get<any>(`/v1/memory/documents?${qs.toString()}`);
      return (Array.isArray(r) ? r : r?.documents ?? []) as MemoryDocument[];
    },
    getMemoryDoc: (id: string) => http.get<MemoryDocument>(`/v1/memory/documents/${id}`),
    createMemoryDoc: (agentId: string, path: string, content: string) =>
      http.post<MemoryDocument>("/v1/memory/documents", { agent_id: agentId, path, content }),
    deleteMemoryDoc: (id: string) => http.del(`/v1/memory/documents/${id}`),
  };
}
