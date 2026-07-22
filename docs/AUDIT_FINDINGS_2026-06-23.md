# Audit Findings — hummbl-dev/mcp-server

**Date**: 2026-06-23
**Auditor**: devin (GLM-5.2, T2-COGNITION)
**Method**: `/mtsmu-review` lens — bug-first, severity-ordered, evidence-cited
**Scope**: `manifest.json` (MCP server JSON) + REST API (`src/api.ts`, `src/http-server.ts`, `src/routes/relationships.ts`, `src/openapi.ts`, `src/auth/`, `src/storage/d1-client.ts`)
**Repo state at audit**: `main` branch, v1.2.0, latest GitHub release v1.0.3

## Severity rollup

| Severity | Count | IDs |
|---|---|---|
| HIGH | 5 | A1, A3, B1, B2, B3 |
| MEDIUM | 11 | A2, A4, A5, A6, B4, B5, B6, B7, B8, B11, B14, B15 |
| LOW | 9 | A7, A8, A9, A10, B10, B12, B13, B16, B17, B18 |

---

## A. manifest.json (MCP server JSON)

### A1. Version drift vs GitHub releases — HIGH
- `manifest.json` and `package.json` both declare `1.2.0`.
- Latest GitHub release is `v1.0.3` (published 2026-02-05).
- Either 1.1.x / 1.2.0 were never tagged/released, or the version bump skipped the release workflow. Consumers installing from npm get 1.2.0; consumers checking GitHub releases see 1.0.3. Reconcile by cutting a `v1.2.0` release or rolling the version back.

### A2. `manifest_version: "0.3"` is non-standard — MEDIUM
No public MCP spec defines a server manifest schema at version `0.3`. This appears to be a self-invented schema. Either (a) document what `0.3` means and where the schema lives, or (b) align to a standard (e.g., the MCP registry format if/when published, or the Claude Desktop `mcp_config` shape).

### A3. `mcp_config.args` uses `${__dirname}` in an ESM package — HIGH
`manifest.json` lines 26-29 declare `mcp_config.args` using `${__dirname}`.
`package.json` declares `"type": "module"` (ESM). `__dirname` is **not defined** in ESM — `src/index.ts` correctly uses `import.meta.url` + `fileURLToPath`. A consumer copy-pasting the manifest's `mcp_config` into their Claude Desktop config will get a `ReferenceError` at runtime. Replace with an absolute path or a runtime-resolved equivalent.

### A4. `tools_generated: true` but no tools enumerated — MEDIUM
The server registers tools statically across 4 modules (`src/server.ts` lines 26-29). `AGENTS.md` lists 9 tools (`get_model`, `list_all_models`, `search_models`, `recommend_models`, `get_transformation`, `search_problem_patterns`, `export_models`, `get_methodology`, `audit_model_references`). The manifest declares neither a `tools` array nor a count. The `tools_generated: true` flag has nothing to back it up. Either enumerate tools or drop the flag.

### A5. No `capabilities` field — MEDIUM
The server registers tools, resources, AND prompts (`src/server.ts` lines 31-36). The manifest doesn't declare `capabilities: { tools, resources, prompts }`. Discoverability loss for clients/registries.

### A6. No `transport` field; only stdio declared — MEDIUM
The server supports three transports: stdio (`src/index.ts`), HTTP/SSE (`src/http-server.ts`), and Cloudflare Workers (`src/api.ts`). `REMOTE_MCP_SUBMISSION.md` and `REMOTE_MCP_DEPLOYMENT.md` exist. The manifest only declares stdio via `mcp_config`. Remote deployment surface is invisible to manifest consumers.

### A7. `description` couples to Claude specifically — LOW
`manifest.json` line 6 says "gives Claude access to 120 validated mental models". `package.json` description is client-agnostic. A protocol-level manifest shouldn't name a specific client.

### A8. `keywords` drift vs `package.json` — LOW
- manifest: `["mental-models", "cognitive-framework", "problem-solving", "decision-making", "structured-reasoning", "base120"]`
- package.json: `["mcp", "model-context-protocol", "mental-models", "hummbl", "cognitive-framework", "problem-solving"]`

Neither includes `mcp` / `model-context-protocol` (manifest) nor `base120` (package). Align both for discoverability.

### A9. `compatibility.claude_desktop: ">=1.0.0"` — LOW
Unsourced claim. No test or CI matrix validates a minimum Claude Desktop version. Either cite a source or mark as "untested".

### A10. `privacy_policies: ["https://hummbl.io/privacy"]` — LOW
URL not verified to resolve. Confirm the policy page exists before publishing the manifest.

---

## B. REST API — `src/api.ts` + `src/http-server.ts` + `src/routes/relationships.ts`

### B1. Duplicate route registration — shadowed dead code — HIGH
`api.ts` registers relationship routes directly AND mounts `relationshipsRoutes` at `/v1` (`src/api.ts` line 534). Hono matches first-registered wins. The `api.ts` versions are registered first, so the `routes/relationships.ts` versions of these 6 endpoints are **unreachable dead code**:

| Path | api.ts (live) | routes/relationships.ts (dead) |
|---|---|---|
| `GET /v1/relationships` | line 292 | line 60 |
| `GET /v1/relationships/:id` | line 275 | line 94 |
| `GET /v1/models/:code/relationships` | line 139 | line 114 |
| `POST /v1/relationships` | line 156 | line 147 |
| `PATCH /v1/relationships/:id` | line 230 | line 221 |
| `DELETE /v1/relationships/:id` | line 255 | line 267 |

Only `GET /v1/graph` (routes/relationships.ts:293) is unique and reachable.

### B2. Two conflicting create-relationship schemas — HIGH (consequence of B1)
The two `POST /v1/relationships` handlers expect **different request bodies**:
- **api.ts:156** (live): `{ source_code, target_code, relationship_type, confidence, evidence }` — calls `db.createRelationship`
- **routes/relationships.ts:147** (dead): `{ model_a, model_b, relationship_type, direction, logical_derivation, literature_support, ... }` — calls `db.createCanonicalRelationship`

The OpenAPI doc (`src/openapi.ts` lines 77-90) matches the **api.ts** schema, confirming routes/relationships.ts is the abandoned one. `db.createCanonicalRelationship` (d1-client.ts:502) is called from **exactly one place** — the dead handler — so it is also dead code.

**B2 survey results**: See `docs/B2_SCHEMA_SURVEY_2026-06-23.md` for full evidence. The codebase is mid-migration from `source_code`/`target_code` (legacy) → `model_a`/`model_b` (canonical). The DB schema, D1 client, and tests all use `model_a`/`model_b`. The live api.ts handler is the lagging surface still speaking the legacy dialect. **Operator decision pending** on the fix approach.

### B3. Unauthenticated relationship reads on a public Workers URL — HIGH
`GET /v1/relationships`, `GET /v1/relationships/:id`, `GET /v1/models/:code/relationships`, and `GET /v1/graph` have **no `authenticate` middleware** (api.ts:139, 275, 292; routes/relationships.ts:293). The API is deployed at `https://hummbl-api.hummbl.workers.dev` (`src/config/mcp.ts` line 7).

**Operator decision**: Public-read intended. The Base120 graph is an educational public resource. Document the policy in `AGENTS.md` + `README.md`, leave reads unauthenticated, only gate writes (POST/PATCH/DELETE already have `authenticate`).

### B4. `total = relationships.length` is wrong for pagination — MEDIUM
`src/api.ts` lines 305-312 — the code comment admits "This is approximate, should be improved". `total` is the count of the current page's rows, not the total matching count. Paginating clients will miscompute page count. Same pattern at routes/relationships.ts:77. Needs a separate `COUNT(*)` query.

### B5. CORS wildcard `*` on authenticated routes — MEDIUM
- http-server.ts:60 sets `Access-Control-Allow-Origin: *` globally, including `/sse` and `/message` which require auth.
- api.ts:49 uses `hono/cors()` with default (permissive) config.

Any origin can drive authenticated requests from a browser. Restrict to known origins (e.g., `https://hummbl.io`, `https://playground.*`).

### B6. `/v1/recommend` silently swallows persistence errors — MEDIUM
`src/api.ts` lines 481-492 — `void db.insertRecommendation(...).catch(() => {})`. Usage-tracking data loss is invisible. At minimum log to stderr; ideally emit an observability counter.

### B7. `/v1/recommend` body parse failure returns 500, not 400 — MEDIUM
`src/api.ts` lines 428-429 — `const { problem } = await c.req.json();` throws on non-JSON body, caught by `app.onError` → 500. Malformed client input should be 400. Wrap in try/catch or validate content-type.

### B8. No input length caps — MEDIUM
- `/v1/recommend` requires `problem.length >= 10` but no max (`src/api.ts` line 431).
- `/v1/search` requires `q.length >= 2`, no max (`src/api.ts` line 360).

Unbounded strings feed `PATTERN_BM25_INDEX.score()` and `searchModels()`. Add a generous max (e.g., 10k chars) to bound BM25 cost.

### B9. `zod` is a dependency but unused on API routes — MEDIUM
`package.json` lists `zod ^4.4.3` but `api.ts` and `routes/relationships.ts` use ad-hoc `if (!body.x)` checks. The `/v1/recommend` and create-relationship handlers would benefit from zod schemas. Inconsistent with having the dep.

### B10. Inconsistent `parseInt` validation — LOW
- api.ts:300-301 and routes/relationships.ts:72-73 use `parseInt(c.req.query("limit")!)` with no radix and no NaN guard. `limit=abc` → `NaN` passed to D1 client.
- api.ts:510 does it correctly: `Math.min(Math.max(parseInt(limitParam ?? "20", 10) || 20, 1), 100)`.

Lift the correct pattern into a shared helper and apply everywhere.

### B11. `relationships.ts:185` ID generation collides — MEDIUM
`src/routes/relationships.ts` line 185 — `R${Date.now().toString().slice(-6)}` yields only 6 digits of timestamp. Two creates in the same second collide. `nanoid` is already a dependency and is used correctly at api.ts:483. Use it here too. (Note: this handler is currently dead per B1, but if revived, fix first.)

### B12. Two `/health` endpoints with incompatible shapes — LOW
- api.ts `/health`: `{status, version, timestamp, models_count}` (`src/api.ts` lines 97-104)
- http-server.ts `/health`: `{status, version, transport, authentication, timestamp, capacity}` (`src/http-server.ts` lines 78-91)

Clients can't rely on a common schema. Also, `models_count: 120` is hardcoded — should be `getAllModels().length`.

### B13. `/health` leaks capacity info — LOW
http-server.ts `/health` exposes `max_concurrent` and `active_connections`. Helps attackers time DoS against the self-hosted deployment. Move capacity details behind auth or remove.

### B14. SSE transport is the older MCP pattern — MEDIUM
`http-server.ts` uses `SSEServerTransport` (`src/http-server.ts` line 11). The MCP SDK has moved toward Streamable HTTP transport. `REMOTE_MCP_DEPLOYMENT.md` exists, so this may be known. Flag for migration planning.

### B15. OAuth session/state stored in-memory — MEDIUM (production-fragility)
`src/auth/oauth.ts` lines 60-64 — `stateStore` and `sessionStore` are in-process `Map`s. The comment at line 59 admits "in production, use Redis or database". On the Workers deployment (`src/api.ts`), this OAuth path isn't used (api.ts uses API keys via KV), but `http-server.ts` (self-hosted) relies on it. A process restart drops all sessions. `@upstash/redis` is already a dependency — wire it in.

### B16. `app.onError` stringifies errors — LOW
`src/api.ts` lines 537-540 — `console.error(`${err}`)` loses the stack. Log the error object directly: `console.error(err)`.

### B17. No request ID / trace correlation — LOW
No middleware assigns request IDs. `@opentelemetry/*` deps are installed (package.json:66-71) but no OTel instrumentation is wired in `api.ts` or `http-server.ts`. Observability gap given the deps.

### B18. `/v1/models/:code` silent fallback — LOW
`src/api.ts` lines 124-133 — if D1 lookup fails, returns the basic model with no signal that enriched data is missing. Clients can't distinguish full vs partial responses. Add a `enriched: boolean` field or a `404`/`503` distinction.

---

## C. Cross-cutting

### C1. OpenAPI doc matches the live (api.ts) schema — confirms B2
`createRelationshipRequestSchema` in `src/openapi.ts` lines 77-90 uses `source_code`/`target_code`/`evidence` — the api.ts shape, not the routes/relationships.ts shape. The OpenAPI is correct *for the live handler*, which confirms routes/relationships.ts is the abandoned one.

### C2. `REPO_HEALTH.md` doesn't mention the route shadowing — LOW
`docs/REPO_HEALTH.md` is the declared source of truth for validation but doesn't catch B1/B2. A lint test that diffs OpenAPI paths against registered Hono routes would catch this class of bug.

---

## Recommended fix order

1. **B1 + B2** — delete the dead `routes/relationships.ts` handlers and `db.createCanonicalRelationship`, OR migrate api.ts to `model_a`/`model_b` primary with `source_code`/`target_code` as deprecated alias (see B2 survey). Pick one. This is the highest-leverage cleanup.
2. **B3** — document the public-read policy in `AGENTS.md` + `README.md` (operator decision: public-read intended).
3. **A1** — cut `v1.2.0` release or roll version back.
4. **A3** — fix `${__dirname}` in manifest before any consumer uses it.
5. **B5** — restrict CORS.
6. Then the MEDIUMs in any order.

---

## Operator decisions (2026-06-23)

- **B2**: Operator reviewing evidence in `docs/B2_SCHEMA_SURVEY_2026-06-23.md` before deciding. Recommended third option: migrate api.ts to `model_a`/`model_b` primary with `source_code`/`target_code` as deprecated alias.
- **B3**: Public-read intended. Document policy, leave reads unauthenticated, gate writes only.
