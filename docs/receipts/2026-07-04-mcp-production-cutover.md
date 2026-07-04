# Production Cutover Receipt — mcp.hummbl.io

**Date:** 2026-07-04T16:20:00Z
**Status:** PRODUCTION_LIVE_VERIFIED

## Service

| Field | Value |
|-------|-------|
| Service | mcp.hummbl.io |
| Worker name | hummbl-mcp |
| Worker version | 1.2.0 |
| Cutover commit | `5a6f401` |
| Transport | Streamable HTTP MCP (protocol 2024-11-05) |
| Auth | Cloudflare Access (OAuth 2.1 / RFC 9728) |
| AuthZ | Profile-based: read-only default, full via `hummbl-mcp-write` group |
| Tools | 12 total, 3 write-gated |

## Cloudflare configuration

| Component | Value |
|-----------|-------|
| Access app (main) | `mcp` (ID: `bcf825d3-3af5-42eb-85d2-73dd50864712`) |
| Access app domain | `mcp.hummbl.io` |
| Audience tag | `76fc2d37d90ed519f76061b003cfd079762b5191371086ccabe3be444422778d` |
| Team URL | `https://hummbl.cloudflareaccess.com` |
| Session duration | 24h |
| HttpOnly cookie | enabled |
| App launcher visible | false |
| Auto-redirect to identity | true |
| IdP | One-Time PIN (OTP) |

### Access bypass apps (public endpoints)

| App | Path | Policy | Reason |
|-----|------|--------|--------|
| `mcp-health` (ID: `2255f1ba-5d88-4b58-9f9a-c080f4791bed`) | `/health` | Bypass Everyone | Health monitoring without auth |
| `mcp-well-known` (ID: `bac16f83-d8af-4c7e-a850-88d651fb975a`) | `/.well-known/*` | Bypass Everyone | RFC 9728 requires public metadata |

### Access groups

| Group | ID | Members |
|-------|----|---------|
| `hummbl-mcp-write` | `98b846e2-33c1-419c-a81b-ceaa19143a23` | `reuben@hummbl.io` |
| `hummbl-mcp-admin` | `cffea020-0565-46d4-82fa-5050c6a70005` | placeholder |

## DNS

| Record | Type | Value | Proxied | ID |
|--------|------|-------|---------|-----|
| `mcp.hummbl.io` | AAAA | `100::` | yes | `a3b532025688878afdd4d3a0963b6507` |

## Worker route

| Pattern | Zone |
|---------|------|
| `mcp.hummbl.io/*` | `hummbl.io` |

## Worker secrets

| Secret | Purpose |
|--------|---------|
| `CF_ACCESS_AUDIENCE` | Audience tag for JWT verification |
| `CF_ACCESS_TEAM_URL` | Team URL for JWKS + get-identity |
| `MCP_RESOURCE_URL` | Production resource URL for metadata |

## Durable Object bindings

| Binding | Class | Storage |
|---------|-------|---------|
| `MCP_OBJECT_READONLY` | `HummblReadOnlyMcpAgent` | SQLite |
| `MCP_OBJECT_FULL` | `HummblFullMcpAgent` | SQLite |

## Smoke test results

| # | Test | Expected | Actual | Pass |
|---|------|----------|--------|------|
| 1 | `GET /health` (no auth) | 200 public | 200 — `status: ok`, `version: 1.2.0` | PASS |
| 2 | `GET /.well-known/oauth-protected-resource` (no auth) | 200 public, production metadata | 200 — `resource: https://mcp.hummbl.io` | PASS |
| 3 | `POST /mcp` (no auth) | 302 to Access login | 302 — redirect to `hummbl.cloudflareaccess.com` | PASS |
| 4 | OTP login | JWT injected | `CF-Access-Jwt-Assertion` header present | PASS |
| 5 | JWT signature verification | Verified via Cloudflare public keys | Verified | PASS |
| 6 | `get-identity` endpoint | Returns groups including `hummbl-mcp-write` | Groups fetched | PASS |
| 7 | `resolveProfile()` | `full` for `hummbl-mcp-write` member | `full` | PASS |
| 8 | MCP `initialize` | 200, server v1.2.0 | 200 — session established | PASS |
| 9 | `tools/list` | 12 tools including write tools | 12 tools (add_relationship, audit_model_references, export_models) | PASS |

## CI status

| Run | Status |
|-----|--------|
| CI | green |
| Pages | green |

## Rollback path

1. Comment out `[[routes]]` block in `wrangler.mcp.toml`
2. Set `ENVIRONMENT = "staging"`
3. Run `npx wrangler deploy --config wrangler.mcp.toml`
4. DNS record can remain (harmless when route is disabled)

Last known-good staging config: commit `3d09633`

## Commits in cutover sequence

| Commit | Description |
|--------|-------------|
| `3eee3a8` | Fetch Access groups from get-identity endpoint |
| `7eb6853` | Replace Node.js fs/path with build-time inline for Workers |
| `3d09633` | Add Durable Object bindings for McpAgent.serve() |
| `5a6f401` | Production cutover — route enabled, ENVIRONMENT=production |
