# HUMMBL MCP Server — Authentication Architecture

## Overview

The Streamable HTTP transport (`mcp-agent.ts`) uses **Cloudflare Access** as the authentication gateway and **Web Crypto API** for JWT verification inside the Worker.

```
Client (Claude/Cursor/etc.)
       │
   mcp.hummbl.io (Cloudflare Access protected)
       │
   Access validates identity (GitHub/Google/Okta/etc.)
       │
   Access injects CF-Access-Jwt-Assertion header
       │
   Worker verifies JWT signature via Web Crypto API
       │
   Based on Access groups → read-only or full tool profile
       │
   McpAgent.serve("/mcp") handles MCP protocol
```

## Why Cloudflare Access (not Express OAuth)

The legacy `src/auth/oauth.ts` is Express + Node.js `crypto` + in-memory `Map` storage. It cannot run on Cloudflare Workers because:

- Express middleware signature (`Request`/`Response`/`NextFunction`) is not Workers-compatible
- `crypto.randomBytes()` / `crypto.createHash()` are Node.js APIs, not Web Crypto
- In-memory `Map` storage doesn't persist across Worker isolate invocations

Cloudflare Access handles the entire OAuth/OIDC flow externally. The Worker only verifies the injected JWT — stateless, no session storage, no OAuth server code.

## Auth flow

1. **Discovery**: Client fetches `/.well-known/oauth-protected-resource` to learn where to authenticate
2. **Authentication**: Client redirects user to Cloudflare Access (the `authorization_servers` URL from metadata)
3. **Token injection**: Access validates identity and injects `CF-Access-Jwt-Assertion` header into subsequent requests
4. **Verification**: Worker verifies JWT signature using Cloudflare's public keys (Web Crypto `crypto.subtle.verify`)
5. **Authorization**: Worker checks the user's Access groups to select a tool profile
6. **Serving**: Worker delegates to `McpAgent.serve("/mcp")` with the appropriate tool profile

## Profile-level authorization

Instead of parsing JSON-RPC bodies to inspect individual tool calls, the Worker selects an entire server profile:

| Identity | Profile | Tools available |
|----------|---------|-----------------|
| Unauthenticated | (rejected) | None — 401 |
| Authenticated, no special groups | `readonly` | model, methodology, export, resources, prompts |
| Authenticated + `hummbl-mcp-write` group | `full` | All tools including `start_workflow`, `continue_workflow` |
| Authenticated + `hummbl-mcp-admin` group | `full` | Same as write (reserved for future expansion) |

This avoids brittle request-body inspection and aligns with issue #342's tool exposure profile work.

## Configuration

### Environment variables / secrets

| Variable | Required in production | Description |
|----------|----------------------|-------------|
| `ENVIRONMENT` | Yes | Set to `production` for production, `staging` for dev |
| `CF_ACCESS_AUDIENCE` | Yes (production) | Cloudflare Access audience tag for this Worker |
| `CF_ACCESS_TEAM_URL` | Yes (production) | e.g., `https://hummbl.cloudflareaccess.com` |
| `MCP_RESOURCE_URL` | Yes (production) | e.g., `https://mcp.hummbl.io` |
| `MCP_AUTH_DOCS_URL` | No | Link to this documentation (defaults to GitHub) |
| `ALLOW_UNAUTHENTICATED_MCP_HTTP` | Never in production | Set to `true` to bypass auth in staging/dev only |

### Setting secrets

```bash
wrangler secret put CF_ACCESS_AUDIENCE
wrangler secret put CF_ACCESS_TEAM_URL
wrangler secret put MCP_RESOURCE_URL
```

### Fail-closed behavior

- **Production without `CF_ACCESS_AUDIENCE` or `CF_ACCESS_TEAM_URL`**: Returns 500 `server_misconfiguration`
- **Production with missing `MCP_RESOURCE_URL`**: Protected Resource Metadata endpoint returns 500 `metadata_misconfiguration`
- **Unauthenticated request**: Returns 401 `missing_token`
- **Invalid/expired/wrong-audience token**: Returns 401 `invalid_token`

## Endpoints

| Endpoint | Auth required | Purpose |
|----------|--------------|---------|
| `GET /health` | No | Health check — returns server status |
| `GET /.well-known/oauth-protected-resource` | No | RFC 9728 metadata — tells clients where to authenticate |
| `POST /mcp` | Yes | MCP Streamable HTTP endpoint |

## Route enablement (operator-controlled)

The `mcp.hummbl.io/*` route in `wrangler.mcp.toml` is **disabled by default**. To enable:

1. Uncomment the `[[routes]]` block in `wrangler.mcp.toml`
2. Set `ENVIRONMENT = "production"`
3. Set secrets: `CF_ACCESS_AUDIENCE`, `CF_ACCESS_TEAM_URL`, `MCP_RESOURCE_URL`
4. Configure a Cloudflare Access policy for `mcp.hummbl.io`
5. Verify auth tests pass and a real login flow works
6. Get operator approval for route enablement

This is a **separate operator-approved final step**, not part of the implementation PR.

## Testing

Tests are in `src/__tests__/auth.test.ts` and cover:

- Missing token → 401
- Malformed token → 401
- Expired token → 401
- Wrong audience → 401
- Valid read-only user → read-only profile
- Valid write-group user → full profile
- Protected Resource Metadata → 200 with RFC 9728 fields
- Health endpoint (unauthenticated) → 200
- Production misconfiguration → 500

JWT verification tests use a real RSA key pair generated with `crypto.subtle.generateKey()` — no external dependencies, no network calls.

## Migration from legacy SSE

The legacy Express-based HTTP/SSE server (`src/http-server.ts`) with GitHub OAuth (`src/auth/oauth.ts`) remains untouched until issue #344. During migration:

- New clients use Streamable HTTP (`/mcp`) with Cloudflare Access
- Old clients continue using SSE (`/sse` + `/message`) with GitHub OAuth
- After migration period, #344 retires the SSE server
