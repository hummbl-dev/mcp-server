# Client Connection Guide — mcp.hummbl.io

## Endpoint

```
https://mcp.hummbl.io/mcp
```

## Authentication

**Cloudflare Access** handles authentication. The server follows OAuth 2.1 / RFC 9728.

### Discovery

Fetch the protected resource metadata to learn the authorization server:

```bash
curl https://mcp.hummbl.io/.well-known/oauth-protected-resource
```

Response:

```json
{
  "resource": "https://mcp.hummbl.io",
  "authorization_servers": ["https://hummbl.cloudflareaccess.com"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://github.com/hummbl-dev/mcp-server/blob/main/docs/auth.md"
}
```

### Login flow

1. Client sends a request to `https://mcp.hummbl.io/mcp`
2. Cloudflare Access intercepts and redirects to the login page
3. User authenticates via One-Time PIN (email-based)
4. Access injects `CF-Access-Jwt-Assertion` header and `CF_Authorization` cookie
5. Worker verifies the JWT signature and fetches group membership
6. MCP session is established

### Token format

The `CF-Access-Jwt-Assertion` header contains a RS256-signed JWT. The Worker verifies it using Cloudflare's public keys from `https://hummbl.cloudflareaccess.com/cdn-cgi/access/certs`.

## Transport

**Streamable HTTP** (MCP protocol version 2024-11-05).

### Required headers

```
Content-Type: application/json
Accept: application/json, text/event-stream
```

### Session management

After `initialize`, the server returns a `Mcp-Session-Id` header. Include this header in all subsequent requests:

```
Mcp-Session-Id: <session-id-from-initialize>
```

## Authorization profiles

| Profile | Access group | Tools available |
|---------|-------------|-----------------|
| read-only | (default, any authenticated user) | 9 read-only tools |
| full | `hummbl-mcp-write` | 12 tools (includes 3 write tools) |

### Write tools (full profile only)

- `add_relationship` — Add relationships between mental models
- `audit_model_references` — Audit model reference integrity
- `export_models` — Export the model catalog

### Read-only tools

- `get_model` — Get a mental model by code
- `list_all_models` — List all 120 Base120 models
- `search_models` — Search models by keyword
- `get_transformation` — Get transformation details
- `search_problem_patterns` — Search problem patterns
- `recommend_models` — Recommend models for a problem
- `get_related_models` — Get related models
- `get_recommendation_history` — Get past recommendations
- `get_methodology` — Get Self-Dialectical AI methodology

## Example: Full MCP handshake

```bash
# 1. Initialize
curl -X POST https://mcp.hummbl.io/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Cookie: CF_Authorization=<your-jwt>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"my-client","version":"1.0"}}}'

# Response includes Mcp-Session-Id header

# 2. List tools
curl -X POST https://mcp.hummbl.io/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Cookie: CF_Authorization=<your-jwt>" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# 3. Call a tool
curl -X POST https://mcp.hummbl.io/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Cookie: CF_Authorization=<your-jwt>" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_model","arguments":{"code":"P1"}}}'
```

## Public endpoints (no auth required)

| Endpoint | URL |
|----------|-----|
| Health check | `https://mcp.hummbl.io/health` |
| Protected resource metadata | `https://mcp.hummbl.io/.well-known/oauth-protected-resource` |

## Server info

| Field | Value |
|-------|-------|
| Server name | `hummbl-mcp-server` |
| Server version | `1.2.0` |
| Protocol version | `2024-11-05` |
| Capabilities | tools, resources, prompts (all with `listChanged`) |

## Getting write access

To get the full profile (write tools), you must be a member of the `hummbl-mcp-write` Access group. Contact the HUMMBL operator to be added.

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| 302 redirect | Not authenticated | Complete the Access login flow |
| 401 `missing_token` | No JWT header/cookie | Authenticate via Access first |
| 401 `invalid_token` | JWT expired or invalid | Re-authenticate via Access |
| 406 `Not Acceptable` | Missing `Accept` header | Add `Accept: application/json, text/event-stream` |
| 400 `Mcp-Session-Id required` | Missing session ID | Call `initialize` first and use the returned session ID |
