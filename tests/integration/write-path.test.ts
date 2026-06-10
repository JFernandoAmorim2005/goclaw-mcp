import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GoClawClient } from "../../src/client/goclaw-client.js";

const SERVER = process.env.GOCLAW_SERVER ?? "http://localhost:18790";
const TOKEN = process.env.GOCLAW_TOKEN;
const WRITE = process.env.GOCLAW_WRITE_TESTS === "1";

const gatewayOnline = async () => {
  try {
    const r = await fetch(`${SERVER}/health`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch { return false; }
};

/** Retorna true se o endpoint existe (não 404) */
const endpointExists = async (path: string) => {
  try {
    const r = await fetch(`${SERVER}${path}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      signal: AbortSignal.timeout(3000),
    });
    return r.status !== 404;
  } catch { return false; }
};

const online = await gatewayOnline();
const hasCustomTools = online && await endpointExists("/v1/tools/custom");
const hasCron        = online && await endpointExists("/v1/cron");
const hasTeams       = online && await endpointExists("/v1/teams");

// Reportar gaps detectados
if (online) {
  if (!hasCustomTools) console.warn("[gap] /v1/tools/custom → 404 nesta versão do gateway");
  if (!hasCron)        console.warn("[gap] /v1/cron → 404 nesta versão do gateway");
  if (!hasTeams)       console.warn("[gap] /v1/teams → 404 nesta versão do gateway");
}

// --- customTools ---

describe.skipIf(!online || !WRITE || !hasCustomTools)(
  "write-path: customTools",
  () => {
    let client: GoClawClient;
    const ids: string[] = [];

    beforeAll(() => { client = new GoClawClient({ baseUrl: SERVER, token: TOKEN }); });
    afterAll(async () => {
      for (const id of ids) {
        try { await client.customTools.deleteCustomTool(id); } catch {}
      }
    });

    it("create + get + delete", async () => {
      const tool = await client.customTools.createCustomTool({
        name: "cc-test-tool",
        description: "Teste automático CC — apagar",
        parameters: { type: "object", properties: {}, required: [] },
        command: "echo test",
        timeout_seconds: 5,
      });
      expect(tool).toMatchObject({ name: "cc-test-tool" });
      ids.push(tool.id);

      const fetched = await client.customTools.getCustomTool(tool.id);
      expect(fetched.id).toBe(tool.id);

      await client.customTools.deleteCustomTool(tool.id);
      ids.splice(ids.indexOf(tool.id), 1);
    });

    it("list returns array", async () => {
      const list = await client.customTools.listCustomTools();
      expect(Array.isArray(list)).toBe(true);
    });
  }
);

// --- cron ---

describe.skipIf(!online || !WRITE || !hasCron)(
  "write-path: cron",
  () => {
    let client: GoClawClient;
    let agentId: string;
    const ids: string[] = [];

    beforeAll(async () => {
      client = new GoClawClient({ baseUrl: SERVER, token: TOKEN });
      const agents = await client.agents.listAgents();
      agentId = agents[0].id;
    });
    afterAll(async () => {
      for (const id of ids) {
        try { await client.cron.deleteCronJob(id); } catch {}
      }
    });

    it("create + list + delete", async () => {
      const job = await client.cron.createCronJob({
        name: "cc-test-cron",
        expression: "0 3 * * *",
        agent_id: agentId,
        message: "Teste automático CC",
        enabled: false,
      });
      expect(job).toMatchObject({ name: "cc-test-cron", enabled: false });
      ids.push(job.id);

      const list = await client.cron.listCronJobs();
      expect(list.map((j: any) => j.id)).toContain(job.id);

      await client.cron.deleteCronJob(job.id);
      ids.splice(ids.indexOf(job.id), 1);
    });

    it("toggle enable/disable", async () => {
      const job = await client.cron.createCronJob({
        name: "cc-test-toggle",
        expression: "0 4 * * *",
        agent_id: agentId,
        message: "Toggle test",
        enabled: false,
      });
      ids.push(job.id);

      const toggled = await client.cron.toggleCronJob(job.id, true);
      expect(toggled.enabled).toBe(true);

      await client.cron.deleteCronJob(job.id);
      ids.splice(ids.indexOf(job.id), 1);
    });
  }
);

// --- teams ---

describe.skipIf(!online || !WRITE || !hasTeams)(
  "write-path: teams",
  () => {
    let client: GoClawClient;
    let agentId: string;
    const ids: string[] = [];

    beforeAll(async () => {
      client = new GoClawClient({ baseUrl: SERVER, token: TOKEN });
      const agents = await client.agents.listAgents();
      agentId = agents[0].id;
    });
    afterAll(async () => {
      for (const id of ids) {
        try { await client.teams.deleteTeam(id); } catch {}
      }
    });

    it("create + get + delete", async () => {
      const team = await client.teams.createTeam({
        name: "cc-test-team",
        description: "Teste automático CC",
        member_agent_ids: [agentId],
      });
      expect(team).toMatchObject({ name: "cc-test-team" });
      ids.push(team.id);

      const fetched = await client.teams.getTeam(team.id);
      expect(fetched.member_agent_ids).toContain(agentId);

      await client.teams.deleteTeam(team.id);
      ids.splice(ids.indexOf(team.id), 1);
    });

    it("list returns array", async () => {
      const list = await client.teams.listTeams();
      expect(Array.isArray(list)).toBe(true);
    });
  }
);

// Sumário de gaps — sempre corre
describe("write-path: gateway capability report", () => {
  it("documenta endpoints disponíveis", () => {
    const gaps = [
      !hasCustomTools && "/v1/tools/custom (customTools CRUD)",
      !hasCron        && "/v1/cron (cron jobs CRUD)",
      !hasTeams       && "/v1/teams (teams CRUD)",
    ].filter(Boolean);

    if (gaps.length) {
      console.info(`[gateway gaps] ${gaps.length} endpoint(s) não implementados:\n  ${gaps.join("\n  ")}`);
    } else {
      console.info("[gateway] Todos os endpoints write-path disponíveis ✅");
    }
    // teste passa sempre — é documentação, não falha
    expect(true).toBe(true);
  });
});
