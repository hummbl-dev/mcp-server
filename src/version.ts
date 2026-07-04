/**
 * Runtime version for MCP server metadata, API health, and operator banners.
 *
 * The version is inlined at build time via a define replacement.
 * If the build-time replacement is not present, falls back to a static value.
 *
 * Note: We cannot read package.json at runtime in Cloudflare Workers
 * (no Node.js fs/path/url modules). The build script must set this via
 * esbuild's `define` or a wrangler `vars` binding.
 */

// This value is replaced at build time. The string literal here is a fallback.
declare const __SERVER_VERSION__: string | undefined;

export const SERVER_VERSION: string =
  (typeof __SERVER_VERSION__ !== "undefined" && __SERVER_VERSION__) ||
  "1.2.0";
