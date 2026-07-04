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

/**
 * Create a read-only HUMMBL MCP server.
 *
 * Registers only non-mutating tools, resources, and prompts. Excludes
 * workflow write tools (start_workflow, continue_workflow) so that
 * unauthenticated HTTP entrypoints cannot trigger stateful operations.
 *
 * Read-only tools registered:
 * - model tools (get_model, list_all_models, search_models, get_transformation, search_problem_patterns)
 * - methodology tools (get_methodology, audit_model_references)
 * - export tools (export_models — read-only data export)
 * - model + methodology resources
 * - workflow prompts (templates only, not execution)
 */
export function createReadOnlyServer(): McpServer {
  const server = new McpServer({
    name: "hummbl-mcp-server",
    version: SERVER_VERSION,
  });

  registerModelTools(server);
  registerMethodologyTools(server);
  registerExportTools(server);

  registerModelResources(server);
  registerMethodologyResources(server);

  registerWorkflowPrompts(server);

  return server;
}
