/**
 * HUMMBL MCP Server - Streamable HTTP Transport via Cloudflare Agents SDK
 *
 * This is the MCP-compliant Streamable HTTP endpoint that replaces the
 * deprecated SSE transport. Deploy to Cloudflare Workers at mcp.hummbl.io.
 *
 * Clients supported:
 * - Claude Desktop (custom connectors)
 * - Claude Code (.mcp.json with type: "http")
 * - Cursor (.cursor/mcp.json with url)
 * - VS Code (.vscode/mcp.json with url)
 * - Windsurf (mcp_config.json with serverUrl)
 * - Any MCP-compatible client that supports Streamable HTTP
 *
 * Bridging:
 * - stdio-only clients can use `npx mcp-remote https://mcp.hummbl.io/mcp`
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SERVER_VERSION } from "./version.js";
import { registerModelTools } from "./tools/models.js";
import { registerWorkflowTools } from "./tools/workflows.js";
import { registerModelResources } from "./resources/models.js";
import { registerMethodologyTools } from "./tools/methodology.js";
import { registerMethodologyResources } from "./resources/methodology.js";
import { registerWorkflowPrompts } from "./prompts/workflows.js";
import { registerExportTools } from "./tools/export.js";

export class HummblMcpAgent extends McpAgent {
  server = new McpServer({
    name: "hummbl-mcp-server",
    version: SERVER_VERSION,
  });

  async init() {
    // Register all tools (same as stdio server)
    registerModelTools(this.server);
    registerMethodologyTools(this.server);
    registerWorkflowTools(this.server);
    registerExportTools(this.server);

    // Register all resources
    registerModelResources(this.server);
    registerMethodologyResources(this.server);

    // Register all prompts
    registerWorkflowPrompts(this.server);
  }
}

export default {
  fetch: HummblMcpAgent.serve("/mcp"),
};
