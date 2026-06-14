# ChatGPT Developer Mode Connector — v0

**Status:** Private / Developer-mode only  
**Scope:** Read-only transport enablement  
**Not for public app submission**

---

## Purpose

This document describes how to connect ChatGPT Developer Mode to the HUMMBL MCP server over HTTP so that ChatGPT can call HUMMBL mental-model tools as a private connector.

This is **v0** — minimal, read-only, no OAuth, no iframe UI, no public app store submission.

---

## Prerequisites

- Node.js >= 20
- `npm ci` completed in this repo
- A tunnel service (ngrok, Cloudflare Tunnel, or similar) for HTTPS exposure
- OpenAI account with Developer Mode access

---

## Local Run

```bash
npm run dev:chatgpt
```

Server starts on port **3001** (override with `MCP_HTTP_PORT`):

| Endpoint | Purpose |
|----------|---------|
| `http://localhost:3001/health` | Health check |
| `http://localhost:3001/mcp` | MCP Streamable HTTP endpoint |

---

## Tunnel Setup

Expose the local server with HTTPS so ChatGPT can reach it.

### Option A — ngrok

```bash
ngrok http 3001
```

Copy the `https://*.ngrok.app` URL.

### Option B — Cloudflare Tunnel

```bash
cloudflared tunnel --url http://localhost:3001
```

Copy the `https://*.trycloudflare.com` URL.

### Option C — Tailscale Funnel

```bash
tailscale funnel 3001
```

---

## ChatGPT Developer Mode Connection Steps

1. Open ChatGPT → Settings → Developer Mode → Add connector
2. Set the endpoint URL to:
   ```
   https://<your-tunnel-host>/mcp
   ```
3. Save and enable the connector
4. ChatGPT will issue an MCP initialization request to `/mcp`
5. If health check passes (`/health` returns `200`), the connection is live

---

## Smoke-Test Prompts

### Test 1 — Get a single model

```text
Use the HUMMBL app to get model P1.
```

**Expected:** ChatGPT calls `get_model` and returns structured information for P1.

### Test 2 — Search models

```text
Search HUMMBL for models about decision making.
```

**Expected:** ChatGPT calls `search_models` and returns matching models.

### Test 3 — List all models

```text
List all HUMMBL mental models.
```

**Expected:** ChatGPT calls `list_all_models` and returns the full set of 120 models.

### Test 4 — Get a transformation

```text
Show me the P transformation and all its models.
```

**Expected:** ChatGPT calls `get_transformation` with `key: "P"`.

---

## Read-Only Tools (annotated)

These tools carry `readOnlyHint: true` so ChatGPT knows they are safe to call without side effects:

| Tool | What it does |
|------|-------------|
| `get_model` | Retrieve one model by code (P1, IN3, etc.) |
| `list_all_models` | List all 120 models |
| `search_models` | Keyword search across models |
| `get_transformation` | Get transformation details + its models |
| `search_problem_patterns` | Find patterns relevant to a problem |
| `get_methodology` | Get Self-Dialectical AI methodology |
| `audit_model_references` | Audit model references for validity |
| `list_workflows` | List available guided workflows |
| `find_workflow_for_problem` | Match a problem to a workflow |

Tools **without** `readOnlyHint` (caller discretion):

| Tool | Why unannotated |
|------|----------------|
| `start_workflow` | Initiates mutable workflow state |
| `continue_workflow` | Mutates workflow state |
| `export_models` | Can emit large PDF / markdown payloads |

---

## Known Limitations

- **No OAuth / auth:** The v0 endpoint is unauthenticated. Run it locally or behind a tunnel you control. Do not expose directly to the internet.
- **Stateless:** Each MCP request creates a fresh server instance. No persistent sessions.
- **No SSE streaming for long tasks:** Long-running tools may time out in ChatGPT.
- **No iframe / web UI:** ChatGPT Developer Mode connector only. No standalone web interface.
- **HTTPS required:** ChatGPT requires HTTPS for connector endpoints. Localhost HTTP works only for local testing with a tunnel.

---

## Non-Goals (out of scope for v0)

- OAuth or API-key authentication
- Public app store submission
- iframe or web-component UI
- Relationship write tools
- Persistent workflow sessions
- Graph visualization
- Cloudflare-native production deployment
- Major REST API refactor
- Package publishing

---

## Troubleshooting

### "Cannot connect to connector"

- Verify tunnel is running and HTTPS URL is reachable from a browser
- Check `/health` responds with JSON
- Verify ChatGPT Developer Mode URL ends in `/mcp` (not `/`)

### "Tool returned error"

- Check server logs in the terminal running `npm run dev:chatgpt`
- Verify the model code format (e.g., `P1`, not `p1` — though normalization is handled)

### "TypeScript errors"

```bash
npm run typecheck
```

### "Tests fail"

```bash
npm run test
```

---

## Architecture

```
ChatGPT Developer Mode
       |
   HTTPS tunnel
       |
   /mcp (Hono + WebStandardStreamableHTTPServerTransport)
       |
   createServer()  <-- shared with stdio entrypoint (src/index.ts)
       |
   [tools, resources, prompts]
```

`src/mcp-http.ts` reuses `createServer()` from `src/server.ts` so that Claude Desktop (stdio) and ChatGPT (HTTP) share the exact same tool set.
