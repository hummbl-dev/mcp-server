# Deployment Readiness Checklist — `mcp.hummbl.io`

> **Status: NOT READY FOR DEPLOYMENT**
>
> This checklist must be completed and signed off by the operator before
> the `mcp.hummbl.io/*` route is enabled. No automated merge or deploy
> should enable the route without explicit operator approval.

## Purpose

The Streamable HTTP MCP transport (#340) and Cloudflare Access auth (#345) are merged to `main`. This checklist governs the **operator-controlled final step**: enabling the public `mcp.hummbl.io/*` route.

## Prerequisites (must be on `main` before starting)

- [x] #340 — Streamable HTTP transport via Cloudflare Agents SDK — merged
- [x] #345 — Cloudflare Access OAuth 2.1 / RFC 9728 production auth — merged
- [x] #343 — Issue closed by #345
- [x] Route `[[routes]]` block is commented out in `wrangler.mcp.toml`
- [x] `ENVIRONMENT = "staging"` in `wrangler.mcp.toml`
- [x] 441 tests passing, typecheck clean

---

## Phase 1: Cloudflare Access configuration

### 1.1 Create Access application

- [ ] **Create Cloudflare Access application** for `mcp.hummbl.io`
  - Application type: Self-hosted
  - Application domain: `mcp.hummbl.io`
  - Session duration: 24 hours (adjust as needed)

- [ ] **Configure identity providers**
  - GitHub (primary — matches existing OAuth flow in legacy SSE)
  - Additional IdPs as needed (Google, Okta, etc.)

- [ ] **Create Access policy**
  - Policy name: `hummbl-mcp-access`
  - Action: Allow
  - Include: users/groups who should have MCP access
  - Exclude: none (or specific blocklist if needed)

- [ ] **Record the audience tag**
  - Found in: Cloudflare Dashboard → Access → Applications → hummbl-mcp → Application → Audience Tag
  - Format: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (32-char hex)
  - This becomes `CF_ACCESS_AUDIENCE`

### 1.2 Create Access groups for tool profiles

- [ ] **Create `hummbl-mcp-write` group**
  - Members: users who should have write access (workflow tools)
  - This group is checked by `resolveProfile()` in `src/auth/authorization.ts`

- [ ] **Create `hummbl-mcp-admin` group** (reserved)
  - Members: operators/admins
  - Currently maps to `full` profile (same as write)
  - Reserved for future per-tool admin restrictions

### 1.3 Record team URL

- [ ] **Record Cloudflare Access team URL**
  - Format: `https://<team-name>.cloudflareaccess.com`
  - This becomes `CF_ACCESS_TEAM_URL`
  - The Worker fetches public keys from `<team-url>/cdn-cgi/access/certs`

---

## Phase 2: DNS and Worker configuration

### 2.1 DNS

- [ ] **Verify `hummbl.io` zone exists** in Cloudflare account
- [ ] **Create DNS record** for `mcp.hummbl.io` (if not using Workers custom domain directly)
  - Type: A or CNAME (Cloudflare will proxy)
  - Or: use Workers custom domain / route binding

### 2.2 Worker secrets

Set each secret via `wrangler secret put`:

- [ ] `CF_ACCESS_AUDIENCE` — the Access audience tag from Phase 1.1
- [ ] `CF_ACCESS_TEAM_URL` — the team URL from Phase 1.3
- [ ] `MCP_RESOURCE_URL` — `https://mcp.hummbl.io`

Optional:
- [ ] `MCP_AUTH_DOCS_URL` — link to `docs/auth.md` (published URL)

### 2.3 Route enablement diff

The **only** `wrangler.mcp.toml` changes for deployment:

```diff
-# [[routes]]
-# pattern = "mcp.hummbl.io/*"
-# zone_name = "hummbl.io"
+[[routes]]
+pattern = "mcp.hummbl.io/*"
+zone_name = "hummbl.io"

 [vars]
-ENVIRONMENT = "staging"
+ENVIRONMENT = "production"
```

- [ ] **Do NOT commit this diff to the repo** — or if committed, do so in a separate operator-approved PR
- [ ] **Alternative**: keep `wrangler.mcp.toml` as-is and set route + environment via `wrangler` CLI or dashboard

---

## Phase 3: Smoke tests (pre-deployment)

Run these against a staging URL first (e.g., `mcp-staging.hummbl.io` or `wrangler dev` tunnel), then against production.

### 3.1 Unauthenticated endpoints

- [ ] `GET /health` → 200 with JSON `{ "status": "ok", "auth": "cloudflare-access" }`
- [ ] `GET /.well-known/oauth-protected-resource` → 200 with JSON containing:
  - `resource` matches `MCP_RESOURCE_URL`
  - `authorization_servers` contains `CF_ACCESS_TEAM_URL`
  - `bearer_methods_supported` = `["header"]`
  - `resource_documentation` is a valid URL

### 3.2 Unauthenticated MCP (should fail)

- [ ] `POST /mcp` without `CF-Access-Jwt-Assertion` header → 401 `missing_token`
- [ ] `POST /mcp` with malformed JWT → 401 `invalid_token`
- [ ] `POST /mcp` with expired JWT → 401 `invalid_token`
- [ ] `POST /mcp` with wrong-audience JWT → 401 `invalid_token`

### 3.3 Authenticated read-only MCP

- [ ] Authenticate via Cloudflare Access (browser redirect to IdP)
- [ ] `POST /mcp` with valid JWT (user NOT in `hummbl-mcp-write` group)
- [ ] MCP `initialize` handshake succeeds
- [ ] `tools/list` returns read-only tools only (no `start_workflow`, no `continue_workflow`)
- [ ] `tools/call` with `get_model` succeeds
- [ ] `tools/call` with `start_workflow` returns error (tool not found)

### 3.4 Authenticated write-profile MCP

- [ ] `POST /mcp` with valid JWT (user IN `hummbl-mcp-write` group)
- [ ] MCP `initialize` handshake succeeds
- [ ] `tools/list` returns all tools including `start_workflow`, `continue_workflow`
- [ ] `tools/call` with `start_workflow` succeeds (or returns expected workflow error)

### 3.5 Production misconfiguration (fail-closed verification)

- [ ] Deploy with `ENVIRONMENT=production` but missing `CF_ACCESS_AUDIENCE` → 500 `server_misconfiguration`
- [ ] Deploy with `ENVIRONMENT=production` but missing `CF_ACCESS_TEAM_URL` → 500 `server_misconfiguration`
- [ ] `GET /.well-known/oauth-protected-resource` with missing `MCP_RESOURCE_URL` in production → 500 `metadata_misconfiguration`

---

## Phase 4: Production deployment

### 4.1 Deploy

- [ ] **Build**: `npm run build`
- [ ] **Set secrets** (Phase 2.2)
- [ ] **Deploy Worker**: `npx wrangler deploy` (with route enabled in config or via dashboard)
- [ ] **Verify Worker is live**: `curl https://mcp.hummbl.io/health` → 200

### 4.2 Post-deploy verification

- [ ] Run all Phase 3 smoke tests against `https://mcp.hummbl.io`
- [ ] Test real MCP client connection (Claude Desktop, Cursor, or Claude Code with HTTP config)
- [ ] Verify Cloudflare Access login flow works end-to-end
- [ ] Verify read-only user cannot call write tools
- [ ] Verify write-group user can call write tools

---

## Phase 5: Rollback plan

If any smoke test fails or the endpoint is misbehaving:

### Immediate rollback (fastest)

- [ ] **Disable the route** in Cloudflare dashboard:
  - Workers Routes → `mcp.hummbl.io/*` → Delete
  - Or: revert `wrangler.mcp.toml` route block and redeploy

Do not rely on changing `ENVIRONMENT=staging` as the primary rollback path. The safest rollback is to disable the public route entirely.

### Full rollback

- [ ] `git revert` the merge commit for #345 (if auth is broken)
- [ ] `git revert` the merge commit for #340 (if transport is broken)
- [ ] Redeploy: `npx wrangler deploy`
- [ ] Verify `https://mcp.hummbl.io/health` returns 404 or Cloudflare error (route disabled)

### Rollback verification

- [ ] Confirm `mcp.hummbl.io` no longer serves MCP requests
- [ ] Confirm legacy SSE server (`src/http-server.ts`) is unaffected (if still running separately)
- [ ] Post incident note to coordination bus

---

## Phase 6: Operator approval receipt

After all smoke tests pass, the operator signs off:

```
DEPLOYMENT APPROVAL — mcp.hummbl.io

Date: YYYY-MM-DD
Operator: [name]
PR #340 merged: yes (commit 0370df0)
PR #345 merged: yes (commit 0e50cbf)

Cloudflare Access application: [configured / verified]
Access groups: hummbl-mcp-write [created], hummbl-mcp-admin [created]
Secrets set: CF_ACCESS_AUDIENCE [yes], CF_ACCESS_TEAM_URL [yes], MCP_RESOURCE_URL [yes]
Route enabled: mcp.hummbl.io/* [yes]
ENVIRONMENT: production

Smoke tests:
- /health: [pass]
- /.well-known/oauth-protected-resource: [pass]
- Unauthenticated /mcp → 401: [pass]
- Authenticated readonly /mcp: [pass]
- Authenticated write /mcp: [pass]
- Misconfiguration fail-closed: [pass]

Real client test: [client name] [pass/fail]

Approval: [APPROVED / REJECTED]
```

- [ ] **Receipt filed** in coordination bus or governance ledger
- [ ] **Issue #344** updated with deployment date (SSE retirement countdown can begin)

---

## Reference

- Auth architecture: [docs/auth.md](./auth.md)
- Client setup: [docs/CLIENT_SETUP.md](./CLIENT_SETUP.md)
- Auth code: `src/auth/cloudflare-access.ts`, `src/auth/authorization.ts`, `src/auth/protected-resource-metadata.ts`
- MCP agent: `src/mcp-agent.ts`
- Wrangler config: `wrangler.mcp.toml`
