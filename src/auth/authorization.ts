/**
 * Profile-level authorization for MCP HTTP entrypoints.
 *
 * Instead of parsing JSON-RPC bodies to inspect individual tool calls,
 * we select an entire server profile based on the authenticated identity:
 *
 * - unauthenticated: reject (401)
 * - authenticated default: read-only profile (createReadOnlyServer)
 * - authenticated + hummbl-mcp-write group: full profile (createServer)
 * - future: hummbl-mcp-admin group: reserved
 *
 * This avoids brittle request-body inspection and aligns with issue #342's
 * tool exposure profile work.
 */

import type { VerifiedIdentity } from "./cloudflare-access.js";

/** Tool exposure profiles for MCP HTTP entrypoints. */
export type ToolProfile = "readonly" | "full";

/** Cloudflare Access group names that grant elevated profiles. */
export const WRITE_GROUP = "hummbl-mcp-write";
export const ADMIN_GROUP = "hummbl-mcp-admin";

/**
 * Determine the tool profile for an authenticated identity.
 *
 * - Members of `hummbl-mcp-write` group get the `full` profile.
 * - All other authenticated users get the `readonly` profile.
 * - `hummbl-mcp-admin` is reserved for future use (currently same as write).
 *
 * @returns ToolProfile — "full" or "readonly"
 */
export function resolveProfile(identity: VerifiedIdentity): ToolProfile {
  if (identity.groups.includes(WRITE_GROUP)) {
    return "full";
  }
  if (identity.groups.includes(ADMIN_GROUP)) {
    return "full";
  }
  return "readonly";
}

/**
 * Build a 401 response for unauthenticated requests.
 */
export function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({
      error: "missing_token",
      hint: "Authenticate via Cloudflare Access. See /.well-known/oauth-protected-resource for metadata.",
    }),
    {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * Build a 401 response for invalid/expired tokens.
 */
export function invalidTokenResponse(): Response {
  return new Response(
    JSON.stringify({
      error: "invalid_token",
      hint: "The provided token is invalid, expired, or has the wrong audience.",
    }),
    {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * Build a 403 response for insufficient scope (reserved for future per-tool checks).
 */
export function insufficientScopeResponse(): Response {
  return new Response(
    JSON.stringify({
      error: "insufficient_scope",
      hint: "This action requires the hummbl-mcp-write group.",
    }),
    {
      status: 403,
      headers: { "Content-Type": "application/json" },
    }
  );
}
