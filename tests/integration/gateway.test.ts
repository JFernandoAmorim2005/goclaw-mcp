import { describe, it, expect, beforeAll } from "vitest";
import { GoClawClient } from "../../src/client/goclaw-client.js";

const SERVER = process.env.GOCLAW_SERVER ?? "http://localhost:18790";
const TOKEN = process.env.GOCLAW_TOKEN;
const gatewayOnline = async () => {
  try {
    const r = await fetch(`${SERVER}/health`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
};

describe.skipIf(!(await gatewayOnline()))("GoClaw Gateway — integration (read-only)", () => {
  let client: GoClawClient;

  beforeAll(() => {
    client = new GoClawClient({ baseUrl: SERVER, token: TOKEN });
  });

  it("system: health returns ok", async () => {
    const result = await client.system.health();
    expect(result).toMatchObject({ status: "ok" });
  });

  it("agents: listAgents returns array", async () => {
    const result = await client.agents.listAgents();
    expect(Array.isArray(result)).toBe(true);
  });

  it("providers: listProviders returns array", async () => {
    const result = await client.providers.listProviders();
    expect(Array.isArray(result)).toBe(true);
  });

  it("sessions: listSessions returns array", async () => {
    const result = await client.sessions.listSessions();
    expect(Array.isArray(result)).toBe(true);
  });

  it("mcpServers: listMcpServers includes goclaw-mcp", async () => {
    const result = await client.mcpServers.listMcpServers();
    expect(Array.isArray(result)).toBe(true);
    const names = result.map((s: any) => s.name);
    expect(names).toContain("goclaw-mcp");
  });
});
