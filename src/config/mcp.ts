// HUMMBL MCP Configuration
// Environment variables for MCP server integration

// REST API Configuration
export const MCP_CONFIG = {
  // API endpoint - production REST API at api.hummbl.io
  HUMMBL_API_URL: process.env.HUMMBL_API_URL || "https://api.hummbl.io",

  // API key for authenticated requests (optional - enables enhanced recommendations)
  HUMMBL_API_KEY: process.env.HUMMBL_API_KEY,

  // Usage tracking for WAU metrics
  ENABLE_USAGE_TRACKING: process.env.NODE_ENV === "production",
};

/**
 * Inject runtime environment from the Workers/Durable Object env object.
 * Called from McpAgent.init() to make secrets (like HUMMBL_API_KEY) available
 * to tool handlers. In Workers, process.env may not have secrets at module
 * load time, so we patch them in from this.env.
 */
export function injectRuntimeEnv(env: Record<string, string | undefined>): void {
  if (env.HUMMBL_API_KEY && !MCP_CONFIG.HUMMBL_API_KEY) {
    MCP_CONFIG.HUMMBL_API_KEY = env.HUMMBL_API_KEY;
  }
  if (env.HUMMBL_API_URL && !process.env.HUMMBL_API_URL) {
    MCP_CONFIG.HUMMBL_API_URL = env.HUMMBL_API_URL;
  }
}

// Server mode is determined by API key presence
export const SERVER_MODE = MCP_CONFIG.HUMMBL_API_KEY ? "hybrid" : "local-only";

// Informational logging — must use stderr, not stdout.
// MCP uses stdout for JSON-RPC transport; any non-protocol output breaks the connection.
if (SERVER_MODE === "local-only") {
  console.error(
    "ℹ️  Running in local-only mode (all 120 Base120 mental models available)\n" +
      "   Set HUMMBL_API_KEY environment variable to enable enhanced API recommendations"
  );
}

export default MCP_CONFIG;
