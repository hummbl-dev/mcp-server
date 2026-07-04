/**
 * HUMMBL MCP Server - Streamable HTTP Transport via Cloudflare Agents SDK
 *
 * DEPLOYMENT TEMPLATE — do not bind to a public route until auth is implemented.
 *
 * This is the MCP-compliant Streamable HTTP endpoint. Until OAuth 2.1 /
 * Protected Resource Metadata (RFC 9728) auth is wired, this server:
 * - Registers only read-only tools (no start_workflow, no continue_workflow)
 * - Refuses requests in production mode (fail-closed)
 * - Is intended for staging/template use only
 *
 * Clients supported (once auth is enabled for production):
 * - Claude Desktop (custom connectors)
 * - Claude Code (.mcp.json with type: "http")
 * - Cursor (.cursor/mcp.json with url)
 * - VS Code (.vscode/mcp.json with url)
 * - Windsurf (mcp_config.json with serverUrl)
 * - Any MCP-compatible client that supports Streamable HTTP
 *
 * Bridging:
 * - stdio-only clients can use `npx mcp-remote https://mcp.hummbl.io/mcp`
 *
 * Follow-up: Implement OAuth 2.1 / RFC 9728 before enabling public route.
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SERVER_VERSION } from "./version.js";
import { registerModelTools } from "./tools/models.js";
import { registerMethodologyTools } from "./tools/methodology.js";
import { registerExportTools } from "./tools/export.js";
import { registerModelResources } from "./resources/models.js";
import { registerMethodologyResources } from "./resources/methodology.js";
import { registerWorkflowPrompts } from "./prompts/workflows.js";

/**
 * Read-only MCP Agent for Cloudflare Workers.
 *
 * Registers only non-mutating tools until production auth is implemented.
 * Write tools (start_workflow, continue_workflow) are excluded.
 */
export class HummblMcpAgent extends McpAgent {
  server = new McpServer({
    name: "hummbl-mcp-server",
    version: SERVER_VERSION,
  });

  async init() {
    // Read-only tools only — no registerWorkflowTools() until auth lands
    registerModelTools(this.server);
    registerMethodologyTools(this.server);
    registerExportTools(this.server);

    // Resources (all read-only)
    registerModelResources(this.server);
    registerMethodologyResources(this.server);

    // Prompts (templates only, not execution)
    registerWorkflowPrompts(this.server);
  }
}

/**
 * Production fail-closed guard.
 *
 * Wraps the fetch handler. If ENVIRONMENT=production and no auth mode is
 * configured, returns 503 and refuses to serve MCP requests. This prevents
 * accidental public exposure of an unauthenticated endpoint.
 *
 * To disable (UNSAFE — do not use on internet-facing deployments):
 *   set ALLOW_UNAUTHENTICATED_MCP_HTTP=true
 */
const isProduction = (globalThis as any).ENVIRONMENT === "production";
const allowUnauthenticated =
  (globalThis as any).ALLOW_UNAUTHENTICATED_MCP_HTTP === "true";

function failClosedResponse(): Response {
  return new Response(
    JSON.stringify({
      error: "MCP endpoint not available in production without authentication.",
      hint: "Implement OAuth 2.1 / RFC 9728 before enabling this route.",
    }),
    {
      status: 503,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export default {
  // ExecutionContext is a Cloudflare Workers global; use minimal typing here.
  // The Agents SDK serve().fetch() accepts (request, env, ctx).
  async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    // Fail-closed: refuse production requests unless explicitly overridden
    if (isProduction && !allowUnauthenticated) {
      return failClosedResponse();
    }

    return HummblMcpAgent.serve("/mcp").fetch(
      request,
      env as any,
      ctx as any
    );
  },
};
