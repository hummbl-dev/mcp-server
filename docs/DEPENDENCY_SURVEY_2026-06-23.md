# Dependency Survey — mcp-server Audit Remediation

**Date**: 2026-06-23
**Auditor**: devin (GLM-5.2, T2-COGNITION)
**Purpose**: Expand the total option space for remediation. Per operator directive: "nothing is off limits. we can violate stdlib-only if we keep receipts of our reasoning when making the decision."
**Method**: Web research + package.json baseline + finding-by-finding mapping. Reasoning receipts recorded for every add/remove/migrate decision.

## Current baseline (package.json)

**Runtime deps (14)**:
- `@modelcontextprotocol/sdk` ^1.29.0 — MCP SDK (v1.x)
- `@opentelemetry/api`, `core`, `exporter-trace-otlp-http`, `resources`, `sdk-trace-node`, `semantic-conventions` — OTel (6 packages, **installed but unused** per B17)
- `@upstash/redis` ^1.38.0 — Redis client (**installed but unused** per B15)
- `express` ^5.2.1 — web framework for `src/http-server.ts` (self-hosted Node path)
- `express-rate-limit` ^8.5.2 — express-only rate limiter
- `hono` ^4.12.26 — web framework for `src/api.ts` (Cloudflare Workers path)
- `jspdf` ^4.2.1 — PDF generation (for `export_models` tool)
- `nanoid` ^5.1.15 — ID generation
- `zod` ^4.4.3 — schema validation (**installed but unused on API routes** per B9)

**Dev deps (17)**: vitest, eslint, prettier, husky, typescript, @cloudflare/workers-types, etc.

**Notable observations**:
1. **Dual web framework**: `hono` (Workers) + `express` (Node http-server). Two frameworks doing similar work — consolidation candidate.
2. **`express-rate-limit` is express-only** — doesn't help on the Workers/Hono side. The actual Workers rate limiter is a hand-rolled KV fixed-window in `src/__tests__/api-middleware.test.ts`/api-keys logic.
3. **zod, @upstash/redis, @opentelemetry/\* are all installed but unused** — the audit flagged this (B9, B15, B17). "Use what we have" is the first option for these findings.
4. **`@modelcontextprotocol/sdk` is at v1.29.0** — has `StreamableHTTPServerTransport` available (B14 fix without a version bump).

---

## Recommendation summary

| Action | Package | Version | Findings addressed | New dep? |
|---|---|---|---|---|
| **USE** | `hono/request-id` | built-in | B17 (request ID) | No |
| **USE** | `hono/body-limit` | built-in | B8 (input length caps) | No |
| **USE** | `hono/secure-headers` | built-in | B5 (security headers), B13 | No |
| **USE** | `hono/cors` | built-in (already in use) | B5 (CORS restrict) | No |
| **USE** | `hono/logger` | built-in | B16 (error logging), B17 | No |
| **USE** | `hono/testing` | built-in | B2 (POST test) | No |
| **USE** | `zod` ^4.4.3 | already installed | B9 (schemas), B7 (400 not 500) | No |
| **USE** | `@upstash/redis` ^1.38.0 | already installed | B15 (OAuth/session storage) | No |
| **USE** | `nanoid` ^5.1.15 | already installed | B11 (ID generation) | No |
| **USE** | `@modelcontextprotocol/sdk` StreamableHTTPServerTransport | already installed (v1.x) | B14 (SSE → Streamable HTTP) | No |
| **ADD** | `@hono/zod-openapi` | ^1.0.0 | B9, C1 (OpenAPI drift), B2 (schema single-source-of-truth) | **Yes** |
| **ADD** | `@upstash/ratelimit` | ^2.0.0 | Rate-limit hardening (replaces hand-rolled KV + express-rate-limit) | **Yes** |
| **ADD** | `@cloudflare/workers-oauth-provider` | ^0.8.0 | B15 (OAuth in-memory → KV-backed provider) | **Yes** |
| **ADD** | `@redocly/cli` | ^1.0.0 (dev) | C2 (OpenAPI lint in CI) | **Yes (dev)** |
| **REMOVE** | `express` ^5.2.1 | — | Consolidate to Hono (works on both Workers + Node) | — |
| **REMOVE** | `express-rate-limit` ^8.5.2 | — | Replaced by `@upstash/ratelimit` | — |
| **REMOVE** | `@types/express` ^5.0.6 | — | Drops with express | — |
| **MIGRATE** | `@modelcontextprotocol/sdk` v1 → v2 | deferred ADR | B14 long-term, MCP spec alignment | **Yes (future)** |

**Net change**: +3 runtime deps, +1 dev dep, -3 deps (if consolidating). Net: +1 dep. If keeping express: +3 runtime, +1 dev, net +4.

---

## Detailed reasoning receipts

### USE — Hono built-in middleware (zero new deps)

**Findings**: B5 (CORS restrict), B8 (input length caps), B13 (capacity leak), B16 (error logging), B17 (request ID)

**Receipt**: Hono ships 20+ built-in middleware modules, each as a separate entrypoint for tree-shaking. The production-ready stack documented at <https://hono.dev/docs/middleware/builtin> includes:
- `hono/request-id` — generates UUID per request, sets `X-Request-Id` header, accessible via `c.get('requestId')`. Uses `crypto.randomUUID()` (Node 20+, Workers native). Solves B17 request correlation without any dep.
- `hono/body-limit` — enforces max body size, handles `Content-Length` + streaming. Solves B8 input length caps.
- `hono/secure-headers` — Helmet-inspired security headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, etc.). Solves B13 (capacity info leak) by adding defense-in-depth headers.
- `hono/cors` — already in use at `src/api.ts:49`. **CVE-2026-54290** patched in v4.12.25 (we're on ^4.12.26, safe). For B5, configure with explicit `origin: ['https://hummbl.io', 'https://playground.hummbl.io']` instead of default wildcard.
- `hono/logger` — structured request logging. For B16, log error objects directly: `console.error(err)` not `console.error(\`${err}\`)`.
- `hono/testing` — `testClient(app)` helper for type-safe route testing. For B2 POST test.

**Reasoning**: These are already available via the `hono` ^4.12.26 dep. Zero install cost, zero supply-chain risk, zero bundle-size increase. Using built-ins is strictly better than adding third-party equivalents.

### USE — zod ^4.4.3 (already installed)

**Findings**: B9 (zod schemas unused on API routes), B7 (400 not 500 on body parse)

**Receipt**: `zod` is listed in dependencies but `src/api.ts` and `src/routes/relationships.ts` use ad-hoc `if (!body.x)` checks. zod v4 is the current major. For B9, define zod schemas for `/v1/recommend` and create-relationship request bodies, use `hono/validator` + zod to validate — invalid bodies return 400 automatically (solves B7). For B2, the schema migration uses zod as the single source of truth.

**Reasoning**: Already installed, already the industry standard for TS schema validation, integrates with `@hono/zod-openapi` for OpenAPI generation. No reason not to use it.

### USE — @upstash/redis ^1.38.0 (already installed)

**Findings**: B15 (OAuth in-memory → persistent storage)

**Receipt**: `@upstash/redis` is listed but `src/auth/oauth.ts` uses in-process `Map`s for `stateStore` and `sessionStore`. The comment at `src/auth/oauth.ts:59` admits "in production, use Redis or database". For B15, wire `@upstash/redis` (or `@cloudflare/workers-oauth-provider` which uses KV — see below).

**Reasoning**: Already installed, already configured for the Workers environment (REST API, serverless-friendly). The in-memory Map is a known production fragility — process restart drops all sessions.

### USE — nanoid ^5.1.15 (already installed)

**Findings**: B11 (ID generation collision)

**Receipt**: `nanoid` is used correctly at `src/api.ts:483` but `src/routes/relationships.ts:185` uses `R${Date.now().toString().slice(-6)}` (6 digits, same-second collision). For B11, replace with `nanoid()`. Note: B11 handler is currently dead per B1, so this becomes moot if we delete the dead handler. If revived, use nanoid.

**Reasoning**: Already installed, already used elsewhere in the codebase. No reason for the inconsistency.

### USE — @modelcontextprotocol/sdk StreamableHTTPServerTransport (already installed, v1.x)

**Findings**: B14 (SSE → Streamable HTTP)

**Receipt**: `@modelcontextprotocol/sdk` ^1.29.0 includes `StreamableHTTPServerTransport` at `@modelcontextprotocol/sdk/server/streamableHttp.js`. The MCP spec (2025-03-26+) marks HTTP+SSE as deprecated, Streamable HTTP as the standard. The SDK v1.x provides both, with a compatibility example at `src/examples/server/sseAndStreamableHttpCompatibleServer.ts`. For B14, migrate `src/http-server.ts` from `SSEServerTransport` to `StreamableHTTPServerTransport`, host both `/mcp` (new) and `/sse` + `/messages` (legacy) during the transition window.

**Reasoning**: Already installed. v1.x supports both transports. No version bump needed for the initial migration. v2 migration (`@modelcontextprotocol/node` package) is a bigger lift and should be a separate ADR — see MIGRATE below.

### ADD — @hono/zod-openapi ^1.0.0

**Findings**: B9 (zod schemas), C1 (OpenAPI drift), B2 (schema single-source-of-truth)

**Receipt**: `@hono/zod-openapi` v1.0.0 released 2026, supports Zod v4 (we have ^4.4.3). It extends `Hono` → `OpenAPIHono` and generates OpenAPI v3.1 docs directly from zod schemas + route definitions. Single source of truth: the zod schema IS the validation AND the OpenAPI spec. This eliminates the entire class of B1/B2 bugs (OpenAPI doc drifting from actual routes) because the doc is generated from the routes themselves.

**Why not `@asteasolutions/zod-to-openapi`**: That's the underlying engine, pulled in transitively. We don't need it directly.
**Why not `hono-zod-openapi` (the alternative)**: Forces `createRoute()` + `OpenAPIHono` class refactor. `@hono/zod-openapi` is the canonical Hono middleware monorepo package.
**Why not `to-openapi`**: Newer, less adoption, separates spec from routing. The coupling in `@hono/zod-openapi` is actually a feature here (single source of truth).

**Reasoning**: The current `src/openapi.ts` is hand-written and already drifted from the actual route schemas (it matches api.ts but is narrower than what `createRelationship` accepts). Generating from zod eliminates this drift permanently. The B2 schema migration becomes much safer when the OpenAPI doc is auto-generated from the chosen zod schema. **This is the highest-leverage add in the survey.**

### ADD — @upstash/ratelimit ^2.0.0

**Findings**: Rate-limit hardening (not a specific B-finding, but adjacent to B5/B3)

**Receipt**: `@upstash/ratelimit` provides sliding window, token bucket, and fixed window algorithms. Works with `@upstash/redis` we already have. Cloudflare Workers-native (`import { Redis } from "@upstash/redis/cloudflare"`). The current hand-rolled KV fixed-window in the codebase works but: (a) is hand-maintained, (b) doesn't support sliding window or token bucket, (c) `express-rate-limit` only covers the express path. `@upstash/ratelimit` unifies rate limiting across both paths with battle-tested algorithms.

**Why not keep the hand-rolled KV limiter**: It works, but sliding window is more user-friendly (no sudden cutoffs at window boundaries) and token bucket is better for bursty traffic. The hand-rolled code is also more code to maintain.
**Why not `hono/rate-limiter`**: There isn't an official one. Third-party options exist but `@upstash/ratelimit` is the canonical Workers choice.

**Reasoning**: Already have `@upstash/redis`, so the marginal cost is one small dep. Eliminates `express-rate-limit` (express-only) and the hand-rolled KV code. Better algorithms, less code. **Receipt: this is a stdlib-only violation** — we're adding a dep for something we could hand-roll. Justified because: (1) rate-limit algorithms are easy to get wrong, (2) `@upstash/ratelimit` is the documented canonical solution for Workers, (3) it unifies two currently-fragmented rate-limit paths.

### ADD — @cloudflare/workers-oauth-provider ^0.8.0

**Findings**: B15 (OAuth in-memory → persistent storage)

**Receipt**: `@cloudflare/workers-oauth-provider` v0.8.0 (June 2026) is Cloudflare's production-grade OAuth 2.1 provider for Workers. MCP-spec-aligned (spec 2025-11-25). Implements authorization code flow with PKCE, dynamic client registration, token exchange, end-to-end encryption of sensitive data stored in KV. The README explicitly states: "Primary use case: This library powers authentication for MCP (Model Context Protocol) servers." Reference implementation: `cloudflare/ai/demos/remote-mcp-github-oauth`.

**Why not just wire `@upstash/redis` into the existing `src/auth/oauth.ts`**: The existing OAuth code is a custom implementation. `@cloudflare/workers-oauth-provider` is MCP-spec-aligned, audited, and handles edge cases (PKCE, dynamic registration, token refresh, KV encryption) that a custom impl would have to rediscover. However, the current OAuth path is only used by `src/http-server.ts` (self-hosted), NOT by `src/api.ts` (Workers, which uses API keys via KV). So this dep is only needed if we want OAuth on the Workers path too.

**Reasoning**: If the operator wants OAuth on the Workers deployment (e.g., for MCP clients that expect OAuth rather than API keys), this is the canonical solution. If OAuth stays self-hosted-only, wiring `@upstash/redis` into the existing code is sufficient. **Operator decision needed**: do we want OAuth on the Workers path, or keep API-key-only there? **Receipt: this is a stdlib-only violation** — we're adding a dep for OAuth. Justified because: (1) OAuth 2.1 + PKCE is complex and easy to get wrong, (2) this is the MCP-spec-aligned canonical solution, (3) it's Cloudflare's own library with 389K weekly downloads and 17 releases.

### ADD — @redocly/cli ^1.0.0 (devDependency)

**Findings**: C2 (OpenAPI lint in CI to catch B1/B2-class drift)

**Receipt**: `@apidevtools/swagger-parser` (4.6M weekly downloads) validates OpenAPI 3.0 but NOT 3.1. `@redocly/cli` is the modern replacement (the `swagger-cli` README explicitly recommends it). Validates OpenAPI 3.1, lints with custom rules, catches the class of bug where the OpenAPI doc drifts from actual routes. If we use `@hono/zod-openapi` to generate the doc, this becomes a generated-doc validator — less critical but still useful as a CI gate.

**Why not `@apidevtools/swagger-parser`**: Only supports OpenAPI 3.0, and `@hono/zod-openapi` generates v3.1.
**Why not skip CI validation entirely**: The B1/B2 bug was OpenAPI-vs-routes drift. A CI gate catches this class permanently.

**Reasoning**: DevDependency only (no production bundle impact). Catches the exact class of bug that caused B1/B2. **Receipt: this is a stdlib-only violation** — we're adding a dev dep for CI validation. Justified because: (1) the B1/B2 bug cost an audit cycle to find, (2) Redocly is the documented successor to swagger-cli, (3) dev deps have no runtime supply-chain risk.

### REMOVE — express ^5.2.1 + express-rate-limit ^8.5.2 + @types/express ^5.0.6

**Findings**: Architectural consolidation (not a specific finding, but enables cleaner B5/B14 fixes)

**Receipt**: `hono` works on both Cloudflare Workers AND Node.js (`@hono/node-server`). The `src/http-server.ts` currently uses express, but Hono is a strict superset of express's capabilities for our use case. Consolidating to Hono:
- Eliminates `express` (1 dep)
- Eliminates `express-rate-limit` (1 dep, express-only)
- Eliminates `@types/express` (1 dev dep)
- Unifies the middleware stack (CORS, rate limit, request ID, body limit, secure headers) across both deployments
- Simplifies the codebase — one framework, one mental model

**Why NOT remove express**: If the self-hosted Node path is rarely used and the operator doesn't want to touch it, leaving express in place is lower-risk. The consolidation is a refactor, not a bug fix.

**Reasoning**: This is an architectural decision, not a finding fix. **Operator decision needed**: consolidate to Hono (cleaner, -3 deps, refactor cost) or keep dual-framework (safer, no refactor)? **Receipt: removing working code is a stdlib-only violation in spirit** — we're deleting a working express server. Justified because: (1) Hono is already installed and works on Node, (2) the dual-framework split is the root cause of B5 (CORS configured differently in each), (3) -3 deps reduces supply-chain surface.

### MIGRATE — @modelcontextprotocol/sdk v1 → v2 (deferred ADR)

**Findings**: B14 long-term, MCP spec alignment

**Receipt**: MCP SDK v2 splits into multiple packages: `@modelcontextprotocol/server`, `@modelcontextprotocol/client`, `@modelcontextprotocol/node`. `StreamableHTTPServerTransport` is renamed to `NodeStreamableHTTPServerTransport` and moved to `@modelcontextprotocol/node`. Server-side SSE transport is REMOVED in v2. The migration guide is at `ts.sdk.modelcontextprotocol.io/v2/media/migration.md`.

**Why defer**: We're on v1.29.0 which has both `SSEServerTransport` and `StreamableHTTPServerTransport`. The v1.x path lets us migrate to Streamable HTTP (B14) without a major SDK upgrade. v2 migration is a bigger lift (package split, renamed exports, removed SSE) and should be a separate ADR after the initial remediation lands.

**Reasoning**: Two separate changes — (1) SSE → Streamable HTTP transport migration (B14, do now on v1.x), (2) SDK v1 → v2 migration (deferred ADR). Conflating them increases risk. **Receipt: deferring a migration is not a stdlib-only violation** — it's risk management. The v1.x path is supported, the v2 path is new. Land the transport fix first, migrate the SDK later.

---

## Cloudflare Workers Tracing (no dep needed for B17 on Workers)

**Receipt**: Cloudflare Workers provides automatic OTel instrumentation out of the box — `observability.traces.enabled = true` in wrangler config. Auto-captures fetch calls, binding calls (KV, R2, D1, Durable Objects), handler lifecycle. Exports to any OTLP endpoint (Honeycomb, Grafana, Sentry, etc.). Free during beta, billed from March 2026.

**Reasoning**: For the Workers path (`src/api.ts`), B17 (request ID + trace correlation) is solved by:
1. `hono/request-id` for request IDs (built-in)
2. `wrangler.toml: observability.traces.enabled = true` for distributed tracing (zero code)
3. `console.log({requestId, ...})` for structured logs (Workers Logs auto-indexes)

The `@opentelemetry/*` deps (6 packages) are only needed for the Node.js `http-server.ts` path. If we consolidate to Hono + `@hono/node-server`, we could use the same Workers-native pattern... but Node doesn't have auto-instrumentation. So `@opentelemetry/*` stays for the Node path, OR we drop it if we go Workers-only.

**Operator decision**: is the self-hosted Node `http-server.ts` path staying? If yes, `@opentelemetry/*` stays. If Workers-only, drop all 6 OTel packages.

---

## Open questions for operator

1. **OAuth on Workers path?** If yes → add `@cloudflare/workers-oauth-provider` ^0.8.0. If no → wire `@upstash/redis` into existing `src/auth/oauth.ts` (self-hosted only).
2. **Consolidate to Hono?** If yes → remove `express` + `express-rate-limit` + `@types/express`, refactor `src/http-server.ts` to Hono + `@hono/node-server`. If no → keep dual-framework, just fix B5 CORS on both independently.
3. **Self-hosted Node path staying?** If yes → keep `@opentelemetry/*` for Node tracing. If no → drop all 6 OTel packages, use Workers auto-tracing only.
4. **MCP SDK v2 migration timing?** Defer to post-remediation ADR, or bundle into this remediation?

## Recommended minimal-add path (if operator wants the smallest dep footprint)

- **Add**: `@hono/zod-openapi` ^1.0.0 (highest-leverage, solves B9 + C1 + B2)
- **Add**: `@redocly/cli` ^1.0.0 dev (CI gate for OpenAPI drift)
- **Use**: all Hono built-ins (request-id, body-limit, secure-headers, cors, logger, testing)
- **Use**: zod, @upstash/redis, nanoid, @modelcontextprotocol/sdk StreamableHTTP (all already installed)
- **Wire**: @upstash/redis into src/auth/oauth.ts (no new dep)
- **Defer**: @upstash/ratelimit (keep hand-rolled KV), @cloudflare/workers-oauth-provider (unless OAuth-on-Workers wanted), express removal, SDK v2 migration

**Net**: +1 runtime dep, +1 dev dep. Smallest footprint that still solves the highest-leverage findings.

## Recommended full-modernization path (if operator wants the cleanest stack)

- **Add**: `@hono/zod-openapi`, `@upstash/ratelimit`, `@cloudflare/workers-oauth-provider`, `@redocly/cli` (dev), `@hono/node-server` (for Node path)
- **Remove**: `express`, `express-rate-limit`, `@types/express`
- **Use**: all Hono built-ins, zod, @upstash/redis, nanoid
- **Migrate**: MCP SDK v1 → v2 (separate ADR)
- **Drop**: `@opentelemetry/*` (6 packages) IF going Workers-only, OR keep for Node path

**Net**: +4 runtime, +1 dev, -3. Cleanest stack, most refactor work.
