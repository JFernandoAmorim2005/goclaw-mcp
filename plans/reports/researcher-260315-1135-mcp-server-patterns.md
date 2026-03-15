# MCP Server Implementation Patterns Research Report

**Date:** 2026-03-15
**Researcher:** Technical Research Agent
**Status:** Complete

---

## Executive Summary

Model Context Protocol (MCP) is an open standard connecting AI applications to external systems through a standardized protocol. MCP servers expose three core primitives (tools, resources, prompts) via JSON-RPC 2.0, supporting two transport mechanisms (stdio, Streamable HTTP). TypeScript SDK is pre-alpha v2; v1.x remains recommended for production. Enterprise deployments require OAuth 2.1 authentication with proper authorization patterns, token validation, and comprehensive auditing.

---

## 1. MCP Specification & Core Concepts

### Latest Version & Protocol Foundation

- **Current Spec Version:** 2025-06-18 (latest)
- **Backward Compatibility:** Protocol v2024-11-05 supported via HTTP+SSE transport
- **Foundation:** JSON-RPC 2.0 protocol with stateful lifecycle management
- **Design Philosophy:** USB-C for AI — standardized connector for AI→external systems

### Core Architectural Participants

```
MCP Host (AI Application)
├── MCP Client 1 → MCP Server A (Local/STDIO)
├── MCP Client 2 → MCP Server B (Local/STDIO)
└── MCP Client 3 → MCP Server C (Remote/Streamable HTTP)
```

Key distinction: **Single server, multiple clients** (remote), **one server per client** (local STDIO).

### Three Core Primitives (Server → Client)

**1. Tools** — Executable functions for AI actions
- Discovery: `tools/list` (dynamic, can change)
- Execution: `tools/call` with arguments
- Use case: API calls, database operations, file operations
- Returns: Content array with structured results

**2. Resources** — Read-only data sources for context
- Discovery: `resources/list`
- Retrieval: `resources/read`
- Use case: File contents, schema definitions, configuration data
- Supports MIME type specification

**3. Prompts** — Reusable interaction templates
- Discovery: `prompts/list`
- Retrieval: `prompts/get`
- Use case: System prompts, few-shot examples, conversation starters
- Can reference other primitives

### Notification System

Real-time updates from server→client (JSON-RPC notifications, no response expected):
- `tools/list_changed` — When tools added/removed/modified
- `resources/list_changed` — When resources change
- `resources/updated` — When specific resource content changes
- Requires capability negotiation at handshake

### Client Primitives (Client → Server Capabilities)

- **Sampling:** Server requests LLM completion from host
- **Elicitation:** Server requests user input/confirmation
- **Logging:** Server sends debug/monitoring messages

---

## 2. Transport Mechanisms

### 2.1 STDIO Transport

**Architecture:**
- Client launches server as subprocess
- Server reads JSON-RPC from `stdin`, writes to `stdout`
- Messages delimited by newlines (no embedded newlines allowed)
- Stderr captures optional logging

**Characteristics:**
- Optimal for local/single-client scenarios
- Zero network overhead
- Single connection per server instance
- Client responsible for subprocess lifecycle

**Message Format:**
```json
{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {...}}
```

**Constraints:**
- Server MUST NOT write non-MCP data to stdout
- Client MUST NOT write non-MCP data to stdin
- UTF-8 encoding required

### 2.2 Streamable HTTP Transport

**Architecture:**
- Server runs as independent process (can handle multiple clients)
- HTTP POST: Client→Server messages
- HTTP GET: Server→Client streams (SSE - Server-Sent Events)
- Single MCP endpoint supporting POST/GET/DELETE

**POST (Client→Server):**
```http
POST /mcp HTTP/1.1
Authorization: Bearer <token>
Mcp-Session-Id: <uuid>
Content-Type: application/json

{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
```

**Response Types:**
- `Content-Type: application/json` → Single JSON-RPC response
- `Content-Type: text/event-stream` → SSE stream with multiple messages

**GET (Server→Client Streaming):**
```http
GET /mcp HTTP/1.1
Accept: text/event-stream
Mcp-Session-Id: <uuid>
Last-Event-ID: <last_received_event_id>

HTTP/1.1 200 OK
Content-Type: text/event-stream

data: {"jsonrpc": "2.0", "method": "notifications/tools/list_changed"}
```

**Session Management:**
- Server optionally assigns `Mcp-Session-Id` on initialization response
- Client MUST include session ID in all subsequent requests
- Server can terminate sessions (respond with 404)
- Client uses `Last-Event-ID` for stream resumption

**Dual Channel Architecture:**
- Command Channel (POST): Client requests, server responds
- Announcement Channel (GET): Server-initiated notifications/requests
- Enables bidirectional async communication

**Security Requirements:**
- MUST validate `Origin` header (DNS rebinding prevention)
- SHOULD bind to localhost only for local servers
- SHOULD implement proper authentication
- MUST use HTTPS in production (HTTP allowed for localhost dev)

### 2.3 Protocol Version Header

```http
MCP-Protocol-Version: 2025-06-18
```

Required on all HTTP requests for backward compatibility.

### 2.4 Transport Comparison

| Feature | STDIO | Streamable HTTP |
|---------|-------|-----------------|
| **Deployment** | Local subprocess | Remote server |
| **Clients** | Single | Multiple concurrent |
| **Network** | None | HTTP/S |
| **Async** | Request/response | Bidirectional async |
| **Session** | Implicit (process) | Explicit (Mcp-Session-Id) |
| **Auth** | Environment/embedded | OAuth 2.1, bearer tokens |
| **Streaming** | No | Yes (SSE) |

---

## 3. TypeScript/Node.js SDK (@modelcontextprotocol/sdk)

### 3.1 SDK Status & Packages

**Current State:**
- **v2 (pre-alpha):** Main branch, stable v2 release anticipated Q1 2026
- **v1.x:** Recommended for production, receiving bug fixes & security updates for 6+ months post-v2 release
- **Runtimes:** Node.js, Bun, Deno

**Package Structure:**
```bash
@modelcontextprotocol/server    # Server implementation
@modelcontextprotocol/client    # Client implementation
zod@4                           # Peer dependency (schema validation)
```

**Framework Adapters:**
- `@modelcontextprotocol/node` (Node.js HTTP)
- `@modelcontextprotocol/express`
- `@modelcontextprotocol/hono`

### 3.2 Server API Surface

#### Creating Server & Transports

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// STDIO transport (local)
const transport = new StdioServerTransport();
const server = new McpServer({ name: "my-server", version: "1.0.0" });
await server.connect(transport);

// HTTP transport (remote)
const httpTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});
const server = new McpServer({ name: "my-server", version: "1.0.0" });
await server.connect(httpTransport);
await httpTransport.handleRequest(req, res, body);
```

#### Tool Definition (Zod-based)

```typescript
server.tool(
  "calculator_arithmetic",
  {
    title: "Calculator",
    description: "Perform mathematical calculations",
    inputSchema: {
      expression: z.string().describe("Mathematical expression (e.g., '2 + 3 * 4')"),
    },
  },
  async ({ expression }) => ({
    content: [{ type: "text", text: `Result: ${eval(expression)}` }],
  })
);
```

**Alternative (McpServer.registerTool):**
```typescript
server.registerTool(
  "add",
  {
    title: "Addition Tool",
    description: "Add two numbers",
    inputSchema: {
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
    },
  },
  async ({ a, b }) => ({
    content: [{ type: "text", text: `${a} + ${b} = ${a + b}` }],
  })
);
```

#### Resource Definition

```typescript
server.resource(
  "logs://application",
  {
    name: "Application Logs",
    mimeType: "text/plain",
    description: "Current application activity logs",
  },
  async () => ({
    text: await readLogFile(),
  })
);
```

#### Prompt Definition

```typescript
server.prompt(
  "debug_template",
  {
    name: "Debug Assistant Prompt",
    description: "System prompt for debugging assistance",
    arguments: [
      {
        name: "error_type",
        description: "Type of error encountered",
        required: true,
      },
    ],
  },
  async ({ error_type }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Help debug this ${error_type} error...`,
        },
      },
    ],
  })
);
```

### 3.3 Error Handling Patterns

**Protocol Errors (JSON-RPC):**
```typescript
// Automatically wrapped by SDK
throw new Error("Tool execution failed");
// Returns: {"jsonrpc": "2.0", "error": {"code": -32603, "message": "..."}, "id": 1}
```

**Custom Error Codes:**
```typescript
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,  // Server error
    "message": "Tool failed",
    "data": { "details": "Additional context" }
  },
  "id": 1
}
```

---

## 4. Security Best Practices (Enterprise)

### 4.1 Authentication & Authorization Framework

**OAuth 2.1 Required for Production:**
- **For local (STDIO):** Environment variables, embedded credentials acceptable
- **For remote (HTTP):** Full OAuth 2.1 authorization code with PKCE flow
- **Token Strategy:** Short-lived access tokens (15-60 min), refresh tokens for renewal

**Protected Resource Metadata (RFC 9728):**
```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="mcp",
  resource_metadata="https://your-server.com/.well-known/oauth-protected-resource"
```

**Resource Metadata Document (`.well-known/oauth-protected-resource`):**
```json
{
  "resource": "https://your-server.com/mcp",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["mcp:tools", "mcp:resources", "mcp:prompts"]
}
```

### 4.2 Token Validation Strategy

**Preferred Approach: Token Introspection (RFC 7662)**
```http
POST /token/introspect HTTP/1.1
Authorization: Basic <base64(client_id:client_secret)>
Content-Type: application/x-www-form-urlencoded

token=<access_token>&client_id=<client_id>&client_secret=<client_secret>
```

**Response Validation:**
```json
{
  "active": true,
  "scope": "mcp:tools mcp:resources",
  "client_id": "oauth-client-uuid",
  "aud": "https://your-server.com",
  "exp": 1755540817,
  "iat": 1755540757
}
```

**Critical Validation Points:**
1. `active == true` — Token still valid
2. `aud` matches server resource URI — Prevent token reuse attacks
3. `exp > now()` — Not expired
4. Scopes contain required permissions
5. Never trust token without server-side validation

### 4.3 Authorization Patterns

**Five Required Patterns (per MCP spec):**

1. **Scope-based** — Tool/resource access by OAuth scope
   ```typescript
   const requiredScope = "mcp:tools:execute";
   if (!token.scopes.includes(requiredScope)) {
     throw new Error("Insufficient permissions");
   }
   ```

2. **Role-based** — Role claims in JWT
   ```typescript
   const roles = token.claims.realm_access?.roles || [];
   if (!roles.includes("admin")) {
     throw new Error("Admin role required");
   }
   ```

3. **Resource-based** — Resource-specific permissions
   ```typescript
   const allowedResources = await getResourcesForUser(token.sub);
   if (!allowedResources.includes(resourceId)) {
     throw new Error("Resource access denied");
   }
   ```

4. **Attribute-based** — Attribute matching (environment, department, etc.)
   ```typescript
   const userDept = token.claims.department;
   const resourceDept = resource.metadata.department;
   if (userDept !== resourceDept) {
     throw new Error("Department mismatch");
   }
   ```

5. **Delegation-based** — User delegation through roles
   ```typescript
   const delegatedFor = token.claims.delegated_for;
   if (delegatedFor) validateDelegationPermissions(delegatedFor);
   ```

### 4.4 Critical Security Rules

**DO:**
- ✅ Validate tokens against authorization server (introspection or signature verification)
- ✅ Use short-lived tokens (15-60 min), refresh tokens for renewal
- ✅ Store tokens in secure, encrypted storage if caching
- ✅ Implement comprehensive audit logging (who, what, when, why)
- ✅ Require HTTPS in production
- ✅ Use least-privilege scopes per tool
- ✅ Implement rate limiting per authenticated user
- ✅ Validate Origin header to prevent DNS rebinding
- ✅ Bind to localhost only for local HTTP servers
- ✅ Include audience (`aud`) in tokens, validate it server-side

**DON'T:**
- ❌ Skip token validation
- ❌ Log Authorization headers, tokens, or secrets
- ❌ Use catch-all scopes
- ❌ Implement custom token validation/authorization logic
- ❌ Accept HTTP except for localhost development
- ❌ Use long-lived tokens
- ❌ Reuse server credentials for user flows
- ❌ Store credentials in code/source control
- ❌ Trust token metadata without server validation
- ❌ Implement token passthrough (server must validate for itself)

### 4.5 Example: Keycloak Integration (TypeScript)

```typescript
const tokenVerifier = {
  verifyAccessToken: async (token: string) => {
    const response = await fetch(
      "http://keycloak:8080/realms/master/protocol/openid-connect/token/introspect",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token,
          client_id: process.env.OAUTH_CLIENT_ID,
          client_secret: process.env.OAUTH_CLIENT_SECRET,
        }).toString(),
      }
    );

    const data = await response.json();
    if (!data.active) throw new Error("Inactive token");

    // Validate audience
    const audiences = Array.isArray(data.aud) ? data.aud : [data.aud];
    if (!audiences.some(a => a === mcpServerUrl.toString())) {
      throw new Error("Audience mismatch");
    }

    return {
      token,
      clientId: data.client_id,
      scopes: (data.scope || "").split(" "),
      expiresAt: data.exp,
    };
  },
};
```

---

## 5. Supporting Multiple Transports in Single Server

### 5.1 Architectural Pattern

**Dependency Inversion:** Core business logic independent of transport.

```typescript
// Shared business logic layer
class MathTools {
  async add(a: number, b: number): Promise<string> {
    return `${a} + ${b} = ${a + b}`;
  }
}

// Transport-agnostic server factory
function createMcpServer(): McpServer {
  const tools = new MathTools();
  const server = new McpServer({ name: "math-server", version: "1.0.0" });

  server.tool("add", { inputSchema: { a: z.number(), b: z.number() } },
    async ({ a, b }) => ({
      content: [{ type: "text", text: await tools.add(a, b) }],
    })
  );

  return server;
}

// STDIO transport path
if (!process.env.HTTP_PORT) {
  const stdio = new StdioServerTransport();
  const server = createMcpServer();
  await server.connect(stdio);
}

// HTTP transport path
if (process.env.HTTP_PORT) {
  const express = require("express");
  const app = express();

  const http = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });
  const server = createMcpServer();
  await server.connect(http);

  app.post("/mcp", (req, res) => http.handleRequest(req, res, req.body));
  app.get("/mcp", (req, res) => http.handleRequest(req, res));

  app.listen(process.env.HTTP_PORT);
}
```

### 5.2 Runtime Selection

```bash
# STDIO mode
node server.js

# HTTP mode
HTTP_PORT=3000 node server.js

# Or via environment variable
TRANSPORT=stdio node server.js
TRANSPORT=http HTTP_PORT=3000 node server.js
```

### 5.3 Benefits

- **Local Development:** STDIO for rapid iteration, debugging
- **Production Deployment:** HTTP for scalability, multiple concurrent clients
- **Same Business Logic:** No duplication, easier maintenance
- **Flexible Deployment:** Choose transport at runtime

---

## 6. Real-Time Updates & Streaming Patterns

### 6.1 Notification Architecture

**Server-initiated notifications** (via SSE on HTTP, buffered on STDIO):

```typescript
// Notify all connected clients about tool changes
server.setToolsListChanged();

// Notify about resource updates
server.sendResourceUpdated("resource://id");
```

**Notification Flow:**
1. Tool/resource changes on server
2. Server sends notification to client (no response expected)
3. Client receives notification, calls list/get to fetch updated data
4. Ensures consistency without polling

### 6.2 Streaming Long-Running Operations

**SSE Stream with Progress Updates:**
```typescript
server.tool("deploy_application", {...}, async ({ app_id }) => {
  // SSE stream opened automatically for HTTP

  // Send progress updates as notifications
  server.sendNotification({
    jsonrpc: "2.0",
    method: "status/progress",
    params: { operation_id: "deploy-123", progress: 25 },
  });

  await delay(2000);

  server.sendNotification({
    jsonrpc: "2.0",
    method: "status/progress",
    params: { operation_id: "deploy-123", progress: 50 },
  });

  // Final response
  return {
    content: [
      { type: "text", text: "Deployment complete" },
      { type: "resource", resource: "logs://deploy-123" },
    ],
  };
});
```

**Client-side Streaming Handling:**
```typescript
const response = await client.callTool("deploy_application", {
  app_id: "my-app",
});

// On SSE stream:
// - Receives progress notifications in real-time
// - Waits for final response
// - Processes complete result
```

### 6.3 Stream Resumption (Connection Loss)

```http
GET /mcp HTTP/1.1
Mcp-Session-Id: abc-123
Last-Event-ID: event-456  # Resume from this event

HTTP/1.1 200 OK
Content-Type: text/event-stream
id: event-457
data: {"jsonrpc": "2.0", ...}
```

Server replays events after `event-456` on same stream.

---

## 7. Infrastructure & Gateway Servers

### 7.1 AWS Deployment Patterns

**AWS EKS MCP Server (Preview):**
- Fully managed, cloud-hosted MCP server for Kubernetes cluster interactions
- OAuth 2.0 + AWS IAM integration
- CloudTrail audit logging
- Auto-scaling, high availability built-in

**Containerized Architecture on ECS:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
ENV HTTP_PORT=3000
EXPOSE 3000
CMD ["node", "src/server.js"]
```

**ELB + WAF + NAT Pattern:**
```
Internet → CloudFront → ALB → WAF → NAT Gateway → ECS Cluster
                                                      ↓
                                              MCP Servers (Tasks)
                                                      ↓
                                              RDS/DynamoDB
```

**Shared Infrastructure Approach:**
- Multiple MCP servers share NAT, ALB, VPC
- Eliminates idle server costs
- Improves utilization

### 7.2 Kubernetes-Native Gateways

**Obot (2025):**
- Platform combining gateway, catalog, chat client, agent orchestration
- Single Kubernetes-native deployment
- $35M seed funding validates enterprise demand

**IBM ContextForge:**
- Open-source AI gateway federating tools, agents, models, APIs
- Multi-cluster Kubernetes with auto-discovery
- Distributed deployment support

### 7.3 Multi-Tenant Deployment

**Session Isolation Pattern:**
```typescript
// Each tenant gets isolated session
const tenantId = req.headers["x-tenant-id"];
const session = await getOrCreateSession(tenantId);

// Authorize based on tenant context
if (!session.authorized) {
  return res.status(401).send("Not authorized");
}

// Route to tenant-specific tools
const tenantTools = toolRegistry.get(tenantId);
```

**Data Isolation:**
- Tools return only tenant-accessible data
- Resources scoped to tenant
- Audit logs include tenant context

---

## 8. Error Handling & Resilience

### 8.1 Error Categories

| Type | Layer | Handling |
|------|-------|----------|
| **Transport** | TCP/HTTP | Retry with backoff, circuit breaker |
| **Protocol** | JSON-RPC | Return -32600 (Invalid Request) |
| **Application** | Tool/Resource | Custom error codes, detailed messages |

### 8.2 Retry Strategy

**Exponential Backoff with Jitter:**
```javascript
const maxRetries = 3;
const baseDelay = 200; // ms
const maxDelay = 5000; // ms

for (let attempt = 0; attempt < maxRetries; attempt++) {
  try {
    return await callTool(toolName, args);
  } catch (error) {
    if (attempt === maxRetries - 1) throw error;

    // Only retry on transient errors (5xx, network)
    if (error.code >= 400 && error.code < 500) throw error;

    const delay = Math.min(
      baseDelay * Math.pow(2, attempt),
      maxDelay
    );
    const jitter = delay * (0.7 + Math.random() * 0.3);
    await new Promise(r => setTimeout(r, jitter));
  }
}
```

### 8.3 Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private state: "closed" | "open" | "half-open" = "closed";
  private failureCount = 0;
  private lastFailureTime = 0;

  async call(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime > 30000) {
        this.state = "half-open";
      } else {
        throw new Error("Circuit breaker is open");
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.state = "closed";
    this.failureCount = 0;
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= 5) {
      this.state = "open";
    }
  }
}
```

### 8.4 Streaming Error Recovery

**Connection Resumption with Event IDs:**
```typescript
// Client stores last received event ID
let lastEventId = localStorage.getItem("lastEventId") || "0";

while (true) {
  try {
    const response = await fetch("/mcp", {
      headers: {
        "Last-Event-ID": lastEventId,
        "Mcp-Session-Id": sessionId,
      },
    });

    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const event = parseSSEEvent(value);
      lastEventId = event.id;
      localStorage.setItem("lastEventId", lastEventId);

      processEvent(event);
    }
  } catch (error) {
    // Exponential backoff reconnection
    await delay(Math.min(1000 * Math.pow(2, retryCount), 30000));
  }
}
```

---

## 9. Best Practices Summary

### Design Principles
- **YAGNI:** Start with STDIO for local development, migrate to HTTP when needed
- **KISS:** Keep business logic simple, let SDK handle protocol complexity
- **DRY:** Extract shared logic into service classes, don't duplicate tool implementations

### Implementation Checklist
- ✅ Define tools with Zod schemas (automatic validation)
- ✅ Use resources for read-only data, tools for actions
- ✅ Implement proper error handling at all layers
- ✅ Add comprehensive logging (JSON structured logs recommended)
- ✅ Validate all inputs (Zod + business logic)
- ✅ Support notifications for dynamic capability changes
- ✅ Implement token validation via introspection
- ✅ Use least-privilege authorization scopes
- ✅ Handle long-running operations with SSE streaming
- ✅ Implement exponential backoff for retries
- ✅ Support session resumption for HTTP connections

### Deployment Considerations
- Start with STDIO for local testing and iteration
- Migrate to HTTP for production with OAuth 2.1
- Containerize with Node.js Alpine image
- Use health checks on HTTP endpoint
- Implement structured JSON logging
- Set up distributed tracing for multi-tenant
- Monitor error rates and latencies
- Implement rate limiting per authenticated user

---

## 10. Unresolved Questions & Edge Cases

1. **Stateful Long-Running Operations:** How should multi-step workflows be handled? (Tasks primitive is experimental)
2. **Client-Side Tool Calls:** Official SDK doesn't provide client tool call abstraction; developers must implement
3. **Cache Invalidation Strategy:** No official guidance on efficiently updating large resource lists
4. **Custom Transports:** While possible, no reference implementation for WebSocket, gRPC alternatives
5. **Multi-Region Deployment:** How to handle session migration across regions for HTTP transport
6. **Rate Limiting:** No standardized rate limit headers in MCP spec (must implement custom)
7. **Backward Compatibility:** Unknown timeline for v1.x to v2.x migration path
8. **Tool Authorization Granularity:** Can you authorize per tool argument (not just tool)?

---

## References

### Official Documentation
- [Model Context Protocol - Introduction](https://modelcontextprotocol.io/introduction)
- [MCP Architecture Overview](https://modelcontextprotocol.io/docs/learn/architecture)
- [Building MCP Servers](https://modelcontextprotocol.io/docs/develop/build-server)
- [Authorization in MCP](https://modelcontextprotocol.io/docs/tutorials/security/authorization)
- [Transport Specification](https://modelcontextprotocol.io/docs/concepts/transports)

### SDK Repositories
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Reference Servers](https://github.com/modelcontextprotocol/servers)

### Security Resources
- [MCP Server Best Practices for 2026](https://www.cdata.com/blog/mcp-server-best-practices-2026)
- [MCP Security Best Practices - Descope](https://www.descope.com/blog/post/mcp-server-security-best-practices)
- [Securing MCP Servers - InfraCloud](https://www.infracloud.io/blogs/securing-mcp-servers/)
- [MCP Security Risks - Nudge Security](https://www.nudgesecurity.com/post/mcp-security-risks-mcp-server-exposure-and-best-practices-for-the-ai-agent-era)
- [OWASP Gen AI Security - MCP Development Guide](https://genai.owasp.org/resource/a-practical-guide-for-secure-mcp-server-development/)

### Infrastructure & Deployment
- [AWS Guidance: Deploying MCP Servers](https://aws.amazon.com/solutions/guidance/deploying-model-context-protocol-servers-on-aws/)
- [AWS EKS MCP Server Documentation](https://docs.aws.amazon.com/eks/latest/userguide/eks-mcp-introduction.html)
- [Best MCP Gateways for Production - MintMCP](https://www.mintmcp.com/blog/mcp-gateways-for-production-systems-in-2026)
- [Dual-Transport MCP Implementation - Medium](https://medium.com/@kumaran.isk/dual-transport-mcp-servers-stdio-vs-http-explained-bd8865671e1f)
- [One MCP Server, Two Transports - Microsoft](https://techcommunity.microsoft.com/blog/azuredevcommunityblog/one-mcp-server-two-transports-stdio-and-http/4443915)

### Advanced Patterns
- [MCP Streaming Progress Updates - Medium](https://medium.com/@leonid.o.babich/streaming-progress-from-mcp-in-real-time-faaa29c1b574)
- [Real-time Streaming & Notifications](https://deepwiki.com/microsoft/mcp-for-beginners/6.9-real-time-streaming-and-notifications)
- [MCP Reliability Playbook - Google Cloud](https://medium.com/google-cloud/mcp-reliability-playbook-d1a0b1360f52)
- [Error Handling in MCP Servers - MCPcat](https://mcpcat.io/guides/error-handling-custom-mcp-servers/)
- [Resilient AI Agents with MCP - Octopus](https://octopus.com/blog/mcp-timeout-retry)

### TypeScript Implementation
- [Writing MCP Servers with TypeScript - Medium](https://medium.com/@dogukanakkaya/writing-an-mcp-server-with-typescript-b1caf1b2caf1)
- [How to Build MCP Servers - DEV Community](https://dev.to/shadid12/how-to-build-mcp-servers-with-typescript-sdk-1c28)
- [Building MCP Server - FreeCodeCamp](https://www.freecodecamp.org/news/how-to-build-a-custom-mcp-server-with-typescript-a-handbook-for-developers/)

---

**Report Generation Date:** 2026-03-15 14:35 UTC
**Total Research Time:** Comprehensive multi-source investigation
**Data Quality:** High (official docs, multiple industry sources, 2026 current knowledge)
