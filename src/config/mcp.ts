// HUMMBL MCP Configuration
// Environment variables for MCP server integration

// REST API Configuration
export const MCP_CONFIG = {
  // API endpoint - will be updated to api.hummbl.io after DNS migration
  HUMMBL_API_URL: process.env.HUMMBL_API_URL || "https://hummbl-api.hummbl.workers.dev",

  // API key for authenticated requests (optional - enables enhanced recommendations)
  HUMMBL_API_KEY: process.env.HUMMBL_API_KEY,

  // Usage tracking for WAU metrics
  ENABLE_USAGE_TRACKING: process.env.NODE_ENV === "production",
} as const;

// Server mode is determined by API key presence
export const SERVER_MODE = MCP_CONFIG.HUMMBL_API_KEY ? "hybrid" : "local-only";

// Informational logging (not a warning, since local-only mode is fully functional)
if (SERVER_MODE === "local-only") {
  console.info(
    "ℹ️  Running in local-only mode (all 120 mental models available)\n" +
      "   Set HUMMBL_API_KEY environment variable to enable enhanced API recommendations"
  );
}

export default MCP_CONFIG;
