/**
 * HUMMBL MCP Server - Streamable HTTP Transport via Cloudflare Agents SDK
 *
 * Production auth: Cloudflare Access JWT verification + profile-level authorization.
 *
 * Auth flow:
 * 1. Client requests /.well-known/oauth-protected-resource → gets metadata
 * 2. Client authenticates via Cloudflare Access (OAuth/OIDC)
 * 3. Access injects CF-Access-Jwt-Assertion header into requests
 * 4. Worker verifies JWT signature via Web Crypto API
 * 5. Based on identity groups, selects read-only or full tool profile
 * 6. Delegates to McpAgent.serve("/mcp") for MCP protocol handling
 *
 * Profile-level auth:
 * - unauthenticated: 401 missing_token
 * - authenticated default: read-only profile (createReadOnlyServer)
 * - authenticated + hummbl-mcp-write group: full profile (createServer)
 *
 * Clients supported:
 * - Claude Desktop (custom connectors)
 * - Claude Code (.mcp.json with type: "http")
 * - Cursor (.cursor/mcp.json with url)
 * - VS Code (.vscode/mcp.json with url)
 * - Windsurf (mcp_config.json with serverUrl)
 * - Any MCP-compatible client that supports Streamable HTTP
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SERVER_VERSION } from "./version.js";
import { registerModelTools, registerPublicModelTools } from "./tools/models.js";
import { registerMethodologyTools, registerPublicMethodologyTools } from "./tools/methodology.js";
import { registerExportTools } from "./tools/export.js";
import { registerWorkflowTools } from "./tools/workflows.js";
import { registerModelResources } from "./resources/models.js";
import { registerMethodologyResources } from "./resources/methodology.js";
import { registerWorkflowPrompts } from "./prompts/workflows.js";
import { injectRuntimeEnv } from "./config/mcp.js";
import { verifyCloudflareAccessJwt, extractAccessJwt } from "./auth/cloudflare-access.js";
import { serveProtectedResourceMetadata } from "./auth/protected-resource-metadata.js";
import {
  resolveProfile,
  unauthorizedResponse,
  invalidTokenResponse,
} from "./auth/authorization.js";

/**
 * Public MCP Agent — registers only the 8 public read-only tools.
 * No write tools, no export, no workflows, no internal graph tools.
 * Used for the public MCP server (mcp-public.hummbl.io).
 */
export class HummblPublicMcpAgent extends McpAgent {
  server = new McpServer({
    name: "hummbl-mcp-public",
    version: SERVER_VERSION,
  });

  async init() {
    injectRuntimeEnv(this.env as unknown as Record<string, string | undefined>);
    registerPublicModelTools(this.server);
    registerPublicMethodologyTools(this.server);
  }
}

/**
 * Read-only MCP Agent — registers all non-workflow tools.
 * Used for authenticated users without the hummbl-mcp-write group.
 * Note: includes add_relationship, export_models, audit_model_references.
 */
export class HummblReadOnlyMcpAgent extends McpAgent {
  server = new McpServer({
    name: "hummbl-mcp-server",
    version: SERVER_VERSION,
  });

  async init() {
    injectRuntimeEnv(this.env as unknown as Record<string, string | undefined>);
    registerModelTools(this.server);
    registerMethodologyTools(this.server);
    registerExportTools(this.server);

    registerModelResources(this.server);
    registerMethodologyResources(this.server);

    registerWorkflowPrompts(this.server);
  }
}

/**
 * Full MCP Agent — registers all tools including workflow write tools.
 * Used for authenticated users with the hummbl-mcp-write group.
 */
export class HummblFullMcpAgent extends McpAgent {
  server = new McpServer({
    name: "hummbl-mcp-server",
    version: SERVER_VERSION,
  });

  async init() {
    injectRuntimeEnv(this.env as unknown as Record<string, string | undefined>);
    registerModelTools(this.server);
    registerMethodologyTools(this.server);
    registerExportTools(this.server);
    registerWorkflowTools(this.server);

    registerModelResources(this.server);
    registerMethodologyResources(this.server);

    registerWorkflowPrompts(this.server);
  }
}

/**
 * Auth configuration from the Workers environment.
 */
interface AuthEnv {
  ENVIRONMENT?: string;
  CF_ACCESS_AUDIENCE?: string;
  CF_ACCESS_TEAM_URL?: string;
  MCP_RESOURCE_URL?: string;
  MCP_AUTH_DOCS_URL?: string;
  ALLOW_UNAUTHENTICATED_MCP_HTTP?: string;
  MCP_PUBLIC_MODE?: string;
}

/**
 * Resolve auth config from the env object passed to fetch().
 * Falls back to globalThis for non-Workers environments.
 */
function resolveAuthEnv(env: unknown): AuthEnv {
  const envRecord = (env || {}) as Record<string, string | undefined>;
  const globalRecord = globalThis as unknown as Record<string, string | undefined>;
  return {
    ENVIRONMENT: envRecord.ENVIRONMENT || globalRecord.ENVIRONMENT,
    CF_ACCESS_AUDIENCE: envRecord.CF_ACCESS_AUDIENCE || globalRecord.CF_ACCESS_AUDIENCE,
    CF_ACCESS_TEAM_URL: envRecord.CF_ACCESS_TEAM_URL || globalRecord.CF_ACCESS_TEAM_URL,
    MCP_RESOURCE_URL: envRecord.MCP_RESOURCE_URL || globalRecord.MCP_RESOURCE_URL,
    MCP_AUTH_DOCS_URL: envRecord.MCP_AUTH_DOCS_URL || globalRecord.MCP_AUTH_DOCS_URL,
    ALLOW_UNAUTHENTICATED_MCP_HTTP:
      envRecord.ALLOW_UNAUTHENTICATED_MCP_HTTP || globalRecord.ALLOW_UNAUTHENTICATED_MCP_HTTP,
    MCP_PUBLIC_MODE: envRecord.MCP_PUBLIC_MODE || globalRecord.MCP_PUBLIC_MODE,
  };
}

/**
 * Health check endpoint — no auth required.
 */
function healthResponse(): Response {
  return new Response(
    JSON.stringify({
      status: "ok",
      server: "hummbl-mcp-agent",
      version: SERVER_VERSION,
      transport: "streamable-http",
      auth: "cloudflare-access",
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    const authEnv = resolveAuthEnv(env);
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. Health check — no auth required
    if (path === "/health") {
      return healthResponse();
    }

    // 2. Protected Resource Metadata (RFC 9728) — no auth required
    if (path === "/.well-known/oauth-protected-resource") {
      return serveProtectedResourceMetadata(authEnv as Record<string, string | undefined>);
    }

    // 3. Public MCP mode: serve the public agent without auth.
    //    Used by mcp-public.hummbl.io — only 8 read-only tools, no write access.
    //    Golden tests in public-tool-profile.test.ts enforce the tool inventory.
    const isPublicMode = authEnv.MCP_PUBLIC_MODE === "true";
    if (isPublicMode) {
      return HummblPublicMcpAgent.serve("/mcp", { binding: "MCP_OBJECT_READONLY" }).fetch(
        request,
        env as any,
        ctx as any
      );
    }

    // 4. Dev/staging bypass: if not production, allow unauthenticated access
    //    (for local development and testing)
    const isProduction = authEnv.ENVIRONMENT === "production";
    const allowUnauthenticated = authEnv.ALLOW_UNAUTHENTICATED_MCP_HTTP === "true";

    if (!isProduction && allowUnauthenticated) {
      // Dev mode: serve read-only without auth
      return HummblReadOnlyMcpAgent.serve("/mcp", { binding: "MCP_OBJECT_READONLY" }).fetch(
        request,
        env as any,
        ctx as any
      );
    }

    // 4. Extract JWT from Cloudflare Access header
    const jwt = extractAccessJwt(request);
    if (!jwt) {
      return unauthorizedResponse();
    }

    // 5. Verify JWT
    //    In production, CF_ACCESS_AUDIENCE and CF_ACCESS_TEAM_URL are required.
    //    If missing, fail closed with invalid_token (not a bypass).
    const audience = authEnv.CF_ACCESS_AUDIENCE;
    const teamUrl = authEnv.CF_ACCESS_TEAM_URL;

    if (!audience || !teamUrl) {
      // Misconfiguration: auth is required but config is incomplete
      return new Response(
        JSON.stringify({
          error: "server_misconfiguration",
          hint: "CF_ACCESS_AUDIENCE and CF_ACCESS_TEAM_URL must be set when auth is required.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const identity = await verifyCloudflareAccessJwt(jwt, audience, teamUrl);
    if (!identity) {
      return invalidTokenResponse();
    }

    // 6. Resolve tool profile based on identity groups
    const profile = resolveProfile(identity);

    // 7. Delegate to the appropriate MCP Agent based on profile
    if (profile === "full") {
      return HummblFullMcpAgent.serve("/mcp", { binding: "MCP_OBJECT_FULL" }).fetch(
        request,
        env as any,
        ctx as any
      );
    }

    return HummblReadOnlyMcpAgent.serve("/mcp", { binding: "MCP_OBJECT_READONLY" }).fetch(
      request,
      env as any,
      ctx as any
    );
  },
};
