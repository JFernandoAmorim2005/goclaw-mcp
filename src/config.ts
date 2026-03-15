/** Environment-based configuration loader for GoClaw MCP server */

export interface Config {
  /** GoClaw gateway server URL (required) */
  goClawServer: string;
  /** Bearer token for authentication */
  goClawToken: string | undefined;
  /** Default user ID for multi-tenant scoping */
  goClawUserId: string | undefined;
  /** HTTP transport port (default: 3100) */
  mcpPort: number;
  /** Allowed origins for CORS (default: localhost) */
  allowedOrigins: string[];
  /** Rate limit: requests per minute per session (default: 60) */
  rateLimitRpm: number;
  /** Log level (default: info) */
  logLevel: "debug" | "info" | "warn" | "error";
}

const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

/**
 * Load configuration from environment variables.
 * Throws if required variables are missing.
 */
export function loadConfig(): Config {
  const goClawServer = process.env.GOCLAW_SERVER;
  if (!goClawServer) {
    throw new Error(
      "GOCLAW_SERVER environment variable is required. " +
        "Set it to your GoClaw gateway URL (e.g. http://localhost:8080)"
    );
  }

  const logLevel = (process.env.GOCLAW_LOG_LEVEL ?? "info") as Config["logLevel"];
  if (!LOG_LEVELS.includes(logLevel)) {
    throw new Error(
      `Invalid GOCLAW_LOG_LEVEL: "${logLevel}". Must be one of: ${LOG_LEVELS.join(", ")}`
    );
  }

  const mcpPort = parseInt(process.env.GOCLAW_MCP_PORT ?? "3100", 10);
  if (isNaN(mcpPort) || mcpPort < 1 || mcpPort > 65535) {
    throw new Error(`Invalid GOCLAW_MCP_PORT: must be 1-65535`);
  }

  const allowedOrigins = (process.env.GOCLAW_MCP_ALLOWED_ORIGINS ?? "localhost,127.0.0.1,::1")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const rateLimitRpm = parseInt(process.env.GOCLAW_MCP_RATE_LIMIT_RPM ?? "60", 10);

  return {
    goClawServer: goClawServer.replace(/\/+$/, ""), // strip trailing slash
    goClawToken: process.env.GOCLAW_TOKEN || undefined,
    goClawUserId: process.env.GOCLAW_USER_ID || undefined,
    mcpPort,
    allowedOrigins,
    rateLimitRpm,
    logLevel,
  };
}
