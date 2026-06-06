/** Channel endpoints: list, toggle */

import type { HttpClient } from "../http-client.js";
import type { Channel } from "../types.js";

export function channelEndpoints(http: HttpClient) {
  return {
    listChannels: async () => {
      const r = await http.get<any>("/v1/channels/instances");
      return (r?.instances ?? []) as Channel[];
    },
    toggleChannel: (channel: string, enabled: boolean) =>
      http.put<Channel>(`/v1/channels/instances/${encodeURIComponent(channel)}`, { enabled }),
  };
}
