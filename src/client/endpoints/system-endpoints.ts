/** System endpoints: health.
 * NOTE: /v1/status and /v1/models do not exist on the live gateway (404) — removed.
 * The root "GET /" returns {service,status,protocol,endpoints}. */

import type { HttpClient } from "../http-client.js";
import type { HealthStatus } from "../types.js";

export function systemEndpoints(http: HttpClient) {
  return {
    health: () => http.get<HealthStatus>("/health"),
    root: () => http.get<any>("/"),
  };
}
