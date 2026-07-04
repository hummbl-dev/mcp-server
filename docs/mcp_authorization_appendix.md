# MCP Authorization Audit Appendix

## Status

- **Document type:** design note / appendix
- **Issue:** #327
- **Date:** 2026-07-01
- **Source basis:** MCP 2025-06-18 authorization and security-best-practices themes

## Purpose

Document MCP authorization checks relevant to this repo. This is an advisory design note, not a claim of current noncompliance or an exploit validation.

## MCP Authorization Checks

### 1. Resource Indicators

MCP HTTP authorization flows should use resource indicators (RFC 8707) to bind tokens to specific resources.

**Check:** Does the MCP server validate that the token's resource indicator matches the requested resource?

**Current state in this repo:** The MCP server (`@hummbl/mcp-server`) primarily uses stdio transport for local use. HTTP transport is available via `src/http-server.ts` and Cloudflare Workers (`src/api.ts`). Resource indicator validation is not currently implemented for HTTP transport.

**Recommendation:** If HTTP transport is used in production with OAuth, implement resource indicator validation.

### 2. Token Audience Validation

MCP authorization should validate that tokens are issued for the correct audience (the MCP server), not for a different service.

**Check:** Does the MCP server validate the `aud` claim in JWT tokens?

**Current state:** Not implemented. The HTTP server does not currently perform JWT validation.

**Recommendation:** If OAuth/JWT is added, validate `aud` claim against the server's identifier.

### 3. No Token Passthrough

MCP servers should not pass client tokens to downstream services. The server should use its own credentials for downstream calls.

**Check:** Does the MCP server forward client tokens to any downstream service?

**Current state:** The MCP server does not make downstream authenticated calls. It reads local data files and serves model information.

**Recommendation:** If downstream calls are added, use server-side credentials, not client token passthrough.

### 4. Transport Security

MCP HTTP transport should use TLS.

**Check:** Is the HTTP server configured for TLS?

**Current state:** The local HTTP server (`src/http-server.ts`) uses plain HTTP for local development. The Cloudflare Workers deployment (`src/api.ts`) uses TLS via Cloudflare's edge.

**Recommendation:** Local development HTTP is acceptable. Production should use Cloudflare Workers (TLS) or a TLS-terminating proxy.

### 5. Authentication for Sensitive Operations

MCP servers should require authentication for sensitive operations.

**Check:** Are sensitive operations (write, delete, execute) gated behind authentication?

**Current state:** The MCP server is read-only (get_model, list_all_models, search_models, recommend_models, get_transformation, search_problem_patterns, export_models, get_methodology, audit_model_references). No write/execute operations exist.

**Recommendation:** If write operations are added, require authentication for them.

## Relationship to #316

This appendix extends the MCP tool admission work (#316) with authorization-specific checks. The `mcp_tool_admission_receipt` captures whether `authentication_required` is true and what `authorization_model` is used. This appendix provides the detail behind those fields for HTTP transport.

## Do Not Infer

- This appendix does not validate an exploit
- This appendix does not assert current noncompliance
- This appendix does not make dependency automation blocking
- The MCP server is primarily stdio-based for local use; HTTP authz is a future concern
