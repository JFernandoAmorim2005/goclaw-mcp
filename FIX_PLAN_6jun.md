# Plano de Fix — cliente goclaw-mcp (envelope + rotas) — preparado 6-Jun-2026

> Executar numa **sessão dedicada**: editar → `npm run build` → **reiniciar Claude Code** → verificar.
> Não é testável sem reiniciar (o MCP só recarrega no arranque). Fazer **backup do `dist/`** antes.

## Causa raiz (3 problemas)
1. **Envelope.** `src/client/http-client.ts` L104-112 assume `{ok, payload, error}` e faz `return data.payload`. O GoClaw real devolve o **corpo directo** (`{agents:[...]}`, `{providers:[...]}`, `{status:"ok",protocol:3}`) e erro `{error:{code,message}}` **ou** `{error:"string"}`. → todo GET de sucesso devolve `undefined` → formatters crasham em `.length`/`.status`.
2. **Extração de listas.** As listas vêm como objeto nomeado (`{agents:[...]}`), não array nu. Os endpoints tipam `Agent[]` e os tools fazem `.length` directo.
3. **Rotas alucinadas / WS-only.** Vários paths não existem no servidor (verificado vs OpenAPi vivo `GET :18790/v1/openapi.json`, 50 paths) ou são WebSocket-only.

Fonte da verdade: `C:\goclaw\api-reference.md`, `C:\goclaw\docs\18-http-api.md`, `GET http://localhost:18790/v1/openapi.json` (Bearer token em `~/.claude.json` → mcpServers.goclaw.env, ou `C:\goclaw\.env.local`).

---

## FIX 1 — `src/client/http-client.ts` (universal, desbloqueia todos os sucessos)
Substituir o bloco de parsing (~L104-112) por:
```ts
const data = (await response.json()) as any;
if (!response.ok || (data && data.error)) {
  const e = data?.error;
  const apiErr = typeof e === "string"
    ? { code: "ERR_API", message: e, status_code: response.status }
    : { code: e?.code ?? "ERR_API", message: e?.message ?? `HTTP ${response.status}`, status_code: response.status };
  this.onFailure();
  throw new GoClawError(apiErr as ApiErrorData);
}
this.onSuccess();
return data as T;            // corpo directo (era data.payload)
```
(O retry 429/5xx em L97-101 mantém-se — usa `response.status`.)

## FIX 2 — endpoints de lista extraem o campo nomeado
Cada `list*` passa a extrair o array. Campos **confirmados**: `{agents:[]}`, `{providers:[]}`. Os restantes (⚠️ **confirmar via curl** na sessão: `curl -H "Authorization: Bearer $T" :18790/v1/<rota>`):
| Endpoint | Rota | Extrair | Estado |
|---|---|---|---|
| listAgents | `/v1/agents` | `.agents` | ✅ confirmado |
| listProviders | `/v1/providers` | `.providers` | ✅ confirmado |
| listTraces | `/v1/traces` | `.traces` (⚠️conf) | rota ok |
| listSessions | `/v1/sessions` | `.sessions` (⚠️conf) | rota ok |
| listSkills | `/v1/skills` | `.skills` (⚠️conf) | rota ok |
| listMcpServers | `/v1/mcp/servers` | `.servers` (⚠️conf) | rota ok |
| listCustomTools | `/v1/tools/custom` | `.tools`/`.custom_tools` (⚠️conf) | rota ok |
Padrão: `const r = await http.get<any>(path); return r.agents ?? [];`

## FIX 3 — rotas a corrigir (path errado)
| Tool/endpoint | Cliente usa | Real | Acção |
|---|---|---|---|
| `system.status` | `/v1/status` | **não existe** | remover tool `goclaw_status` (ou ler `GET /` → `{service,status,protocol,endpoints}`) |
| `system.listModels` | `/v1/models` | **não existe** | reescrever p/ `GET /v1/providers/{id}/models` (por provider) → `.models` |
| `agent files` | `/v1/agents/{id}/files` | **não existe** | sem equivalente HTTP directo → **desactivar** `goclaw_agent_files_*` (ou via `/v1/storage/files`) |
| `agent links` | `/v1/agents/{id}/links` | **não existe** | usar `/v1/delegations` (GET lista) + `GET /v1/agents/{id}/orchestration` p/ delegate_targets |
| `memory` | `/v1/memory`, `/v1/memory/{id}` | `/v1/memory/documents`, `/v1/agents/{id}/memory/documents` | reescrever paths |
| `channels` | `/v1/channels`, PATCH `/v1/channels/{c}` | `/v1/channels/instances` (CRUD) | reescrever; toggle por PATCH instance |
| `tools/invoke` | body `{tool_id,args}` | `{tool,action,args,...}` | corrigir body (ver api-reference §8) |

## FIX 4 — tools WebSocket-only → desactivar (não funcionam por HTTP, nunca)
Per `docs/18-http-api.md` §"WebSocket-Only": **cron, config, sessions(preview/delete/reset/label), send-messages**.
- Desactivar/remover: `goclaw_cron_*` (`/v1/cron`), `goclaw_config_*` (`/v1/config`), `goclaw_session_preview|delete|reset|label`. Manter só `goclaw_session_list` (`GET /v1/sessions` existe).
- `goclaw_team_*` (`/v1/teams`): ⚠️ confirmar — OpenAPI só lista `/v1/teams/{id}/events` e export; CRUD de teams pode não existir por HTTP. Confirmar antes de manter.

---

## Procedimento de execução (sessão dedicada)
1. **Backup:** `Copy-Item C:\goclaw-mcp\dist C:\goclaw-mcp\dist.bak-PREFIX -Recurse` (reverter = restaurar pasta).
2. Confirmar campos de lista com `curl` (tabela FIX 2) — ajustar nomes.
3. Aplicar FIX 1–4.
4. `cd C:\goclaw-mcp; npm run build` (tsup → dist/index.js).
5. **Reiniciar Claude Code** (o MCP recarrega no arranque).
6. **Verificar** (checklist abaixo). Se as tools falharem a carregar → restaurar `dist.bak`.

## Checklist de verificação (pós-restart)
- [ ] `goclaw_health` → status ok (não "reading status")
- [ ] `goclaw_agent_list` → mostra agente **opus** (não "reading length")
- [ ] `goclaw_agent_get opus` → provider anthropic, model claude-opus-4-8
- [ ] `goclaw_provider_list` → provider anthropic + claude-cli
- [ ] `goclaw_trace_list` → traces (ou "no traces")
- [ ] tools WS-only removidas não aparecem / dão erro claro "não suportado por HTTP"

## Estado do gateway (contexto)
Gateway vivo `:18790` (tarefa `JFA_GoClaw_Gateway` AtLogon). Agente **opus** = anthropic/claude-opus-4-8/thinking=high, **operacional** (verificado via curl 6-Jun). Ver memória `reference_goclaw_mcp_4jun`.
