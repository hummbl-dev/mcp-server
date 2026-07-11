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
 * Tool exposure profiles for server-side enforcement.
 *
 * Profiles control which tools, resources, and prompts are registered
 * on the server. This is server-side enforcement, not a client hint.
 *
 * - `readonly`: model, methodology, export, resources, prompts; no workflow mutation tools.
 * - `dev`: local-only, full tool set behind explicit env override.
 * - `prod`: full or scoped tool set only after auth/authz.
 * - `full`: all tools including workflow mutation (alias for prod without auth gate).
 */
export type ServerProfile = "readonly" | "dev" | "prod" | "full";

export interface ServerOptions {
  profile?: ServerProfile;
}

/**
 * Create and configure the HUMMBL MCP server.
 *
 * Without options, defaults to the full profile (backward compatible).
 * With `{ profile: "readonly" }`, excludes workflow mutation tools.
 */
export function createServer(options?: ServerOptions): McpServer {
  const profile = options?.profile ?? "full";
  return createServerWithProfile(profile);
}

/**
 * Create a server with an explicit profile.
 */
export function createServerWithProfile(profile: ServerProfile): McpServer {
  const server = new McpServer({
    name: "hummbl-mcp-server",
    version: SERVER_VERSION,
  });

  switch (profile) {
    case "readonly":
      registerReadOnlyTools(server);
      break;
    case "dev":
      registerDevTools(server);
      break;
    case "prod":
    case "full":
    default:
      registerAllTools(server);
      break;
  }

  return server;
}

/**
 * Register all tools (full/prod profile).
 */
function registerAllTools(server: McpServer): void {
  registerModelTools(server);
  registerMethodologyTools(server);
  registerWorkflowTools(server);
  registerExportTools(server);

  registerModelResources(server);
  registerMethodologyResources(server);

  registerWorkflowPrompts(server);
}

/**
 * Register read-only tools (readonly profile).
 *
 * Excludes workflow write tools (start_workflow, continue_workflow)
 * so that unauthenticated HTTP entrypoints cannot trigger stateful
 * operations.
 */
function registerReadOnlyTools(server: McpServer): void {
  registerModelTools(server);
  registerMethodologyTools(server);
  registerExportTools(server);

  registerModelResources(server);
  registerMethodologyResources(server);

  registerWorkflowPrompts(server);
}

/**
 * Register dev tools (dev profile).
 *
 * Full tool set for local development. In production, this profile
 * should only be accessible from localhost.
 */
function registerDevTools(server: McpServer): void {
  registerAllTools(server);
}

/**
 * Create a read-only HUMMBL MCP server.
 *
 * Convenience wrapper for `createServer({ profile: "readonly" })`.
 * Kept for backward compatibility.
 *
 * Read-only tools registered:
 * - model tools (get_model, list_all_models, search_models, get_transformation, search_problem_patterns)
 * - methodology tools (get_methodology, audit_model_references)
 * - export tools (export_models — read-only data export)
 * - model + methodology resources
 * - workflow prompts (templates only, not execution)
 */
export function createReadOnlyServer(): McpServer {
  return createServer({ profile: "readonly" });
}
