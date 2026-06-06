/** Skill endpoints: list, get, update, grants */

import type { HttpClient } from "../http-client.js";
import type { Skill } from "../types.js";

export function skillEndpoints(http: HttpClient) {
  return {
    listSkills: async () => {
      const r = await http.get<any>("/v1/skills");
      return (r?.skills ?? []) as Skill[];
    },
    getSkill: (id: string) => http.get<Skill>(`/v1/skills/${id}`),
    updateSkill: (id: string, data: Partial<Skill>) =>
      http.put<Skill>(`/v1/skills/${id}`, data),
    grantSkillAgent: (skillId: string, agentId: string) =>
      http.post(`/v1/skills/${skillId}/grants/agent`, { agent_id: agentId }),
    grantSkillUser: (skillId: string, userId: string) =>
      http.post(`/v1/skills/${skillId}/grants/user`, { user_id: userId }),
  };
}
