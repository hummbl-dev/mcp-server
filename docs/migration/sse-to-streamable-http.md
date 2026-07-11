# SSE to Streamable HTTP Migration Guide

## Status

The legacy HTTP/SSE server (`src/http-server.ts`) is **deprecated** as of
2026-07-11. The production MCP server uses Streamable HTTP via Cloudflare
Workers (`src/mcp-agent.ts` + `src/mcp-http.ts`).

## Background

The MCP SDK supports two HTTP transports:

1. **SSE (legacy)** — `SSEServerTransport` via `/sse` + `/message` endpoints
2. **Streamable HTTP (current)** — `WebStandardStreamableHTTPServerTransport` via `/mcp` endpoint

The legacy SSE server was the original HTTP transport for local development
and early deployment. The Streamable HTTP transport is now the production
path via Cloudflare Workers Durable Objects.

## What changed

| Aspect | SSE (legacy) | Streamable HTTP (current) |
|--------|-------------|--------------------------|
| Entry point | `src/http-server.ts` (Express) | `src/mcp-agent.ts` (Workers DO) |
| Endpoints | `/sse` + `/message` | `/mcp` |
| Transport | `SSEServerTransport` | `WebStandardStreamableHTTPServerTransport` |
| Auth | GitHub OAuth (session-based) | Cloudflare Access (JWT) |
| Deployment | Self-hosted Node.js | Cloudflare Workers |
| Status | Deprecated | Production |

## Migration steps for clients

### If you are using `/sse` + `/message`

1. Update your MCP client to use Streamable HTTP transport
2. Point your client to the new endpoint: `https://mcp.hummbl.io/mcp`
3. Replace session-based auth with Cloudflare Access auth
4. Test tool calls via the new endpoint

### If you are using stdio transport

No migration needed. stdio transport is unchanged.

### If you are using the local dev server (`npm run dev:http`)

The local dev server still works but is deprecated. For local development,
prefer stdio transport (`npm run dev`).

## What is preserved

- OAuth/session logic in `src/auth/oauth.ts` is preserved for reference
- The Express server can still be started via `npm run dev:http` or
  `npm run start:http` for local testing
- No active production deployment uses the SSE transport

## What is deprecated

- `src/http-server.ts` — the Express-based SSE server
- `/sse` and `/message` endpoints
- `npm run dev:http` and `npm run start:http` scripts
- `SSEServerTransport` import

## Removal timeline

The deprecated SSE server will be removed in a future release after:

1. All known clients have migrated to Streamable HTTP
2. No CI or deployment path references the SSE endpoints
3. At least one release cycle has passed with the deprecation notice

## Related

- `hummbl-dev/mcp-server#344` — original issue
- `docs/auth.md` — authentication documentation
- `docs/mcp_authorization_appendix.md` — authorization appendix
- `docs/deployment-readiness.md` — deployment readiness checklist
