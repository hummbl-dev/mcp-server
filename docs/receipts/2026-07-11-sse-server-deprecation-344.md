# Receipt: SSE Server Deprecation (#344)

## Target
- Repository: `hummbl-dev/mcp-server`
- Issue: #344
- Branch: `feat/devin/retire-sse-server-344`

## Scope
- Documented SSE to Streamable HTTP migration path
- Marked `src/http-server.ts` as deprecated
- Added deprecation warning script (`dev:http:deprecated`)
- Verified no active production deployment uses SSE transport

## Changed files
- `docs/migration/sse-to-streamable-http.md` — migration guide for clients
- `src/http-server.ts` — added `@deprecated` JSDoc notice
- `package.json` — added `dev:http:deprecated` warning script

## Validation results
- Documentation-only change — no tests to run
- Verified Streamable HTTP is the production path (`src/mcp-agent.ts` + `src/mcp-http.ts`)
- Verified no wrangler config references `http-server.ts`
- Verified no CI workflow references the SSE endpoints

## What is deprecated
- `src/http-server.ts` — Express-based SSE server
- `/sse` and `/message` endpoints
- `npm run dev:http` and `npm run start:http` scripts
- `SSEServerTransport` import

## What is preserved
- `src/auth/oauth.ts` — OAuth/session logic (preserved for reference)
- The Express server can still be started for local testing
- No code is removed in this change — deprecation notice only

## Removal timeline
The deprecated SSE server will be removed in a future release after:
1. All known clients have migrated to Streamable HTTP
2. No CI or deployment path references the SSE endpoints
3. At least one release cycle has passed with the deprecation notice

## Residual risks
- Clients still using `/sse` + `/message` will need to migrate before removal
- The deprecation notice is documentation-only — no runtime warning is emitted
- The `dev:http` script still works without warning (only `dev:http:deprecated` warns)

## Review requirement
- Yes — transport deprecation should be reviewed before merge

## Cross-references
- `hummbl-dev/mcp-server#344` — this issue
- `docs/auth.md` — authentication documentation
- `docs/mcp_authorization_appendix.md` — authorization appendix
- `docs/deployment-readiness.md` — deployment readiness checklist
