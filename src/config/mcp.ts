// HUMMBL MCP Configuration
// Environment variables for MCP server integration

// REST API Configuration
export const MCP_CONFIG = {
  // API endpoint - will be updated to api.hummbl.io after DNS migration
  HUMMBL_API_URL: process.env.HUMMBL_API_URL || "https://hummbl-api.hummbl.workers.dev",

  // API key for authenticated requests
  // TODO: Generate and set production API key
  HUMMBL_API_KEY: process.env.HUMMBL_API_KEY,

  // Enable hybrid mode (local data + API recommendations)
  HYBRID_MODE: true,

  // Usage tracking for WAU metrics
  ENABLE_USAGE_TRACKING: process.env.NODE_ENV === "production",
} as const;

// Validation
if (MCP_CONFIG.HYBRID_MODE && !MCP_CONFIG.HUMMBL_API_KEY) {
  console.warn("⚠️  HUMMBL_API_KEY not set - recommend_models tool will fail in hybrid mode");
}

export default MCP_CONFIG;
