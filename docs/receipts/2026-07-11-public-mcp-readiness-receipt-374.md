# Public MCP Readiness Receipt (Candidate)

## Receipt metadata

| Field | Value |
|-------|-------|
| `receipt_id` | `public_mcp_readiness_receipt_v0.1` |
| `server_name` | `hummbl-mcp-public` |
| `server_url` | `https://mcp-public.hummbl.io` |
| `status` | `candidate` |
| `created` | 2026-07-11 |
| `issue` | hummbl-dev/mcp-server#374 |
| `parent` | hummbl-dev/mcp-server#348 |

This is **readiness evidence**, not certification or compliance. It documents
the current state of the public MCP surface so that downstream consumers
(ChatGPT App, Custom GPT, unauthenticated MCP clients) and reviewers can
verify what is enforced server-side versus what is merely hinted by Apps SDK
metadata.

## Public tool inventory (server-enforced)

The public agent (`HummblPublicMcpAgent`) registers exactly 8 tools via
`registerPublicModelTools` and `registerPublicMethodologyTools`:

| # | Tool | Purpose |
|---|------|---------|
| 1 | `get_model` | Fetch a single Base120 model by name |
| 2 | `list_all_models` | List all 120 models |
| 3 | `search_models` | Full-text search over model names/descriptions |
| 4 | `get_transformation` | Fetch a transformation family (P/IN/CO/DE/RE/SY) |
| 5 | `search_problem_patterns` | Search models by problem pattern |
| 6 | `recommend_models` | Recommend models for a problem description |
| 7 | `get_related_models` | Fetch models related to a given model |
| 8 | `get_methodology` | Fetch methodology documentation |

All 8 tools are read-only. None accept user-data fields. None mutate state.

## Excluded tools (server-enforced)

The following tools are **NOT** registered on the public agent. This is
enforced by the `registerPublicModelTools` / `registerPublicMethodologyTools`
split, not by runtime checks.

| Tool | Reason excluded |
|------|-----------------|
| `add_relationship` | Write operation (mutates model graph) |
| `audit_model_references` | Internal audit (not for public consumption) |
| `export_models` | Export operation (bulk data extraction) |
| `get_recommendation_history` | User-data (per-user recommendation history) |
| `get_model_relationships` | Internal graph (not exposed publicly) |
| `find_relationship_path` | Internal graph traversal |
| `get_relationship_neighborhood` | Internal graph neighborhood |
| `list_workflows` | Workflow metadata (internal orchestration) |
| `start_workflow` | Write operation (starts a workflow) |
| `continue_workflow` | Write operation (continues a workflow) |
| `find_workflow_for_problem` | Workflow routing (internal) |

## Read-only enforcement

### Hint vs enforcement

| Layer | Mechanism | Status |
|-------|-----------|--------|
| Apps SDK metadata | Tool annotations, descriptions | Hint only — client may ignore |
| Server-side tool registration | `registerPublicModelTools` excludes write tools | Enforced |
| Server-side profile gate | `HummblPublicMcpAgent` only calls public registrars | Enforced |
| CI golden test | `public-tool-profile.test.ts` (12 tests) | Enforced in CI |
| CI boundary test | `public-boundary.test.ts` (8 tests) | Enforced in CI |

The server-side registration split is the enforcement boundary. Apps SDK
metadata is a hint that helps well-behaved clients frame tool calls, but a
malicious or buggy client cannot invoke excluded tools because they are
never registered on the public agent.

### Server tool registration proof

- Source: `src/mcp-agent.ts` lines 52-63 (`HummblPublicMcpAgent.init()`)
- Registrars called: `registerPublicModelTools`, `registerPublicMethodologyTools`
- Registrars NOT called: `registerModelTools`, `registerMethodologyTools`, `registerExportTools`, `registerWorkflowTools`
- Test: `src/__tests__/public-tool-profile.test.ts` — "public agent registers exactly 8 tools"

## Apps SDK metadata

| Field | Value |
|-------|-------|
| `widget_csp` | Not yet configured (MVP: no widgets) |
| `structured_output_schema` | Per-tool Zod schemas (server-side) |
| `apps_sdk_metadata` | Not yet emitted (future: #350) |

Apps SDK widgets are out of scope for the MVP. When added (#350), widget CSP
must be documented here and must not allow inline scripts or external
connections beyond `mcp-public.hummbl.io`.

## Auth model

| Field | Value |
|-------|-------|
| `auth_model` | `anonymous` (MVP — no auth required) |
| `rate_limit` | 60 req/min per IP, 1000 req/hour per IP (planned — Cloudflare WAF or in-Worker token bucket) |

### Future authz boundary

The MVP does not implement OAuth. The following fields document the planned
boundary so reviewers can assess whether the current surface is safe to
expose without OAuth.

| Field | Value |
|-------|-------|
| `oauth_status` | `not_implemented` |
| `resource_indicator_plan` | RFC 8707 `resource` parameter when OAuth is added |
| `audience_validation_plan` | Validate `aud` claim equals `https://mcp-public.hummbl.io` |
| `token_passthrough_forbidden` | `true` — public server must not forward tokens to internal services |
| `401_403_contract` | 401 = no token (future), 403 = valid token but insufficient scope (future). MVP: 200 for all valid requests. |
| `pkce_required` | `true` when OAuth is added (PKCE mandatory for public clients) |
| `redirect_uri_exact_match` | `true` when OAuth is added (no wildcard redirect URIs) |

Until OAuth is implemented, the public server exposes only read-only tools
with no user-data fields. The risk of anonymous access is bounded by:

1. No write tools are registered (server-enforced).
2. No user-data tools are registered (server-enforced).
3. Rate limiting (planned) prevents abuse.
4. No credentials or secrets are accessible to public tools.

## Privacy boundary

| Field | Value |
|-------|-------|
| `privacy_boundary` | No user data collected, stored, or returned |
| `user_data_fields` | None (enforced by `public-boundary.test.ts`) |
| `logging` | No user-identifying data logged (policy — no runtime test yet) |

The public server does not accept, store, or return user data. Tool inputs
are model names, search queries, and problem descriptions — all of which are
public Base120 content. No per-user state is maintained.

## Abuse boundary

| Field | Value |
|-------|-------|
| `abuse_boundary` | Rate-limited read-only access to public model data |
| `abuse_vectors` | Excessive requests, large result sets, scraping |
| `mitigations` | Rate limiting (planned), pagination (per-tool), no bulk export |

## Claim ceiling

This receipt supports the following claims:

- The public MCP server registers exactly 8 read-only tools.
- No write, export, workflow, or user-data tools are registered on the public agent.
- Tool registration separation is enforced server-side and verified by CI tests.
- The public server does not accept or return user data.

This receipt does **NOT** support:

- Claims that the server is "secure" or "compliant" (no penetration test).
- Claims that OAuth is implemented (it is not — MVP is anonymous).
- Claims that rate limiting is enforced (it is planned, not yet implemented).
- Claims that log redaction is enforced at runtime (policy only, no test).
- Claims that the server is safe for arbitrary user data (no user data is accepted).

## Evidence pointers

| Evidence | Location |
|----------|----------|
| Public agent class | `src/mcp-agent.ts:52-63` |
| Public model tools registrar | `src/tools/models.ts:37` (`registerPublicModelTools`) |
| Public methodology tools registrar | `src/tools/methodology.ts:15` (`registerPublicMethodologyTools`) |
| Golden inventory test (12 tests) | `src/__tests__/public-tool-profile.test.ts` |
| Boundary test (8 tests) | `src/__tests__/public-boundary.test.ts` |
| Tool exposure profiles test | `src/__tests__/tool-profiles.test.ts` |
| Wrangler config (public) | `wrangler.mcp-public.toml` |
| Public/private boundary doc | `docs/architecture/public-private-boundary.md` |
| Public boundary threat model | `docs/architecture/public-boundary-threat-model.md` |
| Tool exposure profiles doc | `docs/architecture/tool-exposure-profiles.md` |
| No-user-data boundary receipt | `docs/receipts/2026-07-11-public-no-user-data-boundary-377.md` |

## Do not infer

- Do not infer that anonymous access is safe for all future tools. New tools
  added to `registerPublicModelTools` or `registerPublicMethodologyTools`
  must be reviewed against this receipt.
- Do not infer that the absence of write tools prevents all abuse. Rate
  limiting and pagination are required before production traffic.
- Do not infer that Apps SDK metadata alone provides security. Server-side
  registration is the enforcement boundary.
- Do not infer that the MVP is certified, audited, or compliant with any
  specific framework.

## Cross-references

- hummbl-dev/mcp-server#348 — public read-only MCP server
- hummbl-dev/mcp-server#350 — Apps SDK widgets (future)
- hummbl-dev/mcp-server#316 — MCP tool admission receipt prototype
- hummbl-dev/mcp-server#327 — MCP authz appendix and dependency update receipt
- hummbl-dev/mcp-server#377 — public no-user-data boundary (receipt)
- hummbl-dev/mcp-server#342 — tool exposure profiles

## Review requirement

Yes — this is a candidate receipt for a public-facing trust envelope. Non-author
review is required before promoting from `candidate` to `verified`.
