import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../../src/config.js";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear all GOCLAW_ vars
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("GOCLAW_")) delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws when GOCLAW_SERVER is missing", () => {
    expect(() => loadConfig()).toThrow("GOCLAW_SERVER");
  });

  it("loads with required GOCLAW_SERVER only", () => {
    process.env.GOCLAW_SERVER = "http://localhost:8080";
    const config = loadConfig();
    expect(config.goClawServer).toBe("http://localhost:8080");
    expect(config.goClawToken).toBeUndefined();
    expect(config.goClawUserId).toBeUndefined();
    expect(config.mcpPort).toBe(3100);
    expect(config.logLevel).toBe("info");
    expect(config.rateLimitRpm).toBe(60);
  });

  it("strips trailing slash from server URL", () => {
    process.env.GOCLAW_SERVER = "http://localhost:8080///";
    const config = loadConfig();
    expect(config.goClawServer).toBe("http://localhost:8080");
  });

  it("loads all env vars", () => {
    process.env.GOCLAW_SERVER = "https://goclaw.example.com";
    process.env.GOCLAW_TOKEN = "my-token";
    process.env.GOCLAW_USER_ID = "user-123";
    process.env.GOCLAW_MCP_PORT = "4000";
    process.env.GOCLAW_LOG_LEVEL = "debug";
    process.env.GOCLAW_MCP_ALLOWED_ORIGINS = "example.com,foo.bar";
    process.env.GOCLAW_MCP_RATE_LIMIT_RPM = "120";

    const config = loadConfig();
    expect(config.goClawServer).toBe("https://goclaw.example.com");
    expect(config.goClawToken).toBe("my-token");
    expect(config.goClawUserId).toBe("user-123");
    expect(config.mcpPort).toBe(4000);
    expect(config.logLevel).toBe("debug");
    expect(config.allowedOrigins).toEqual(["example.com", "foo.bar"]);
    expect(config.rateLimitRpm).toBe(120);
  });

  it("rejects invalid log level", () => {
    process.env.GOCLAW_SERVER = "http://localhost:8080";
    process.env.GOCLAW_LOG_LEVEL = "verbose";
    expect(() => loadConfig()).toThrow("GOCLAW_LOG_LEVEL");
  });

  it("rejects invalid port", () => {
    process.env.GOCLAW_SERVER = "http://localhost:8080";
    process.env.GOCLAW_MCP_PORT = "99999";
    expect(() => loadConfig()).toThrow("GOCLAW_MCP_PORT");
  });
});
