/**
 * HUMMBL MCP Server Configuration
 * Central server setup with all tools and resources
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerModelTools } from "./tools/models.js";
import { registerWorkflowTools } from "./tools/workflows.js";
import { registerModelResources } from "./resources/models.js";
import { registerMethodologyTools } from "./tools/methodology.js";
import { registerMethodologyResources } from "./resources/methodology.js";
import { registerWorkflowPrompts } from "./prompts/workflows.js";
import { registerExportTools } from "./tools/export.js";
import { SERVER_VERSION } from "./version.js";

/**
 * Create and configure the HUMMBL MCP server
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "hummbl-mcp-server",
    version: SERVER_VERSION,
  });

  // Register all tools
  registerModelTools(server);
  registerMethodologyTools(server);
  registerWorkflowTools(server); // Phase 2: Guided workflows
  registerExportTools(server);

  // Register all resources
  registerModelResources(server);
  registerMethodologyResources(server);

  // Register all prompts (MCP prompt primitive — user-invocable templates)
  registerWorkflowPrompts(server);

  return server;
}
