/**
 * HUMMBL MCP HTTP Server — ChatGPT Developer Mode Connector (v0)
 *
 * Streamable HTTP transport entry point for private/local ChatGPT
 * Developer Mode integration. Reuses the shared read-only server factory
 * so that stdio (Claude Desktop) and HTTP (ChatGPT) share the same
 * read-only tool set.
 *
 * SECURITY BOUNDARY (code-enforced):
 * - Read-only tools only (no start_workflow, no continue_workflow).
 * - Refuses to start in production mode unless explicitly overridden.
 * - CORS restricted to localhost + configured origins (no wildcard).
 *
 * Usage:
 *   npm run dev:chatgpt        # local development
 *   npm run start:chatgpt      # production build
 *
 * Then tunnel the port and connect ChatGPT Developer Mode to:
 *   https://<tunnel-host>/mcp
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createReadOnlyServer } from "./server.js";
import { SERVER_VERSION } from "./version.js";

const PORT = process.env.MCP_HTTP_PORT ? parseInt(process.env.MCP_HTTP_PORT, 10) : 3001;

const isProduction =
  process.env.NODE_ENV === "production" || process.env.ENVIRONMENT === "production";

const ALLOW_UNAUTHENTICATED = process.env.ALLOW_UNAUTHENTICATED_MCP_HTTP === "true";

// --- Production refusal guard ---
// Refuse to start in production unless an explicit unsafe override is set.
// This prevents accidental deployment of an unauthenticated MCP endpoint.
if (isProduction && !ALLOW_UNAUTHENTICATED) {
  console.error(
    "FATAL: HUMMBL MCP HTTP Server refuses to start in production mode without authentication."
  );
  console.error(
    "  This endpoint is unauthenticated and read-only. It must not be exposed publicly."
  );
  console.error(
    "  To override (UNSAFE — do not expose to the internet), set ALLOW_UNAUTHENTICATED_MCP_HTTP=true."
  );
  process.exit(1);
}

if (isProduction && ALLOW_UNAUTHENTICATED) {
  console.error(
    "WARNING: HUMMBL MCP HTTP Server starting in production with ALLOW_UNAUTHENTICATED_MCP_HTTP=true."
  );
  console.error(
    "  This is unsafe. Do not expose this endpoint to the internet. Bind to localhost or a private network only."
  );
}

// --- CORS allowlist (no wildcard) ---
// Default allowlist covers localhost and 127.0.0.1 on any port.
// Extend via MCP_HTTP_ALLOWED_ORIGINS="https://your-tunnel.example.com,https://another.example.com"
const localhostPatterns = [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];

const configuredOrigins = process.env.MCP_HTTP_ALLOWED_ORIGINS
  ? process.env.MCP_HTTP_ALLOWED_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

const allowedOrigins = [...configuredOrigins];

function isOriginAllowed(origin: string): boolean {
  if (localhostPatterns.some((p) => p.test(origin))) return true;
  if (allowedOrigins.includes(origin)) return true;
  return false;
}

const app = new Hono();

// Restrict CORS to localhost + configured origins (no wildcard)
app.use(
  "*",
  cors({
    origin: (origin) => (origin && isOriginAllowed(origin) ? origin : null),
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "mcp-session-id", "Last-Event-ID", "mcp-protocol-version"],
    exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
  })
);

// Health check
app.get("/health", (c) =>
  c.json({
    status: "ok",
    server: "hummbl-mcp-http",
    version: SERVER_VERSION,
    transport: "streamable-http",
    profile: "read-only",
    timestamp: new Date().toISOString(),
  })
);

// MCP Streamable HTTP endpoint (stateless - fresh transport per request)
// Uses createReadOnlyServer() — write tools (start_workflow, continue_workflow)
// are NOT registered on this unauthenticated HTTP entrypoint.
app.all("/mcp", async (c) => {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: no session IDs
  });
  const server = createReadOnlyServer();
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

// Start server
serve({
  fetch: app.fetch,
  port: PORT,
});

console.error(`HUMMBL MCP HTTP Server v${SERVER_VERSION} running on port ${PORT}`);
console.error(`Health check:  http://localhost:${PORT}/health`);
console.error(`MCP endpoint:   http://localhost:${PORT}/mcp`);
console.error(`Tool profile:   read-only (no workflow write tools)`);
console.error("Ready for ChatGPT Developer Mode connection (tunnel required for HTTPS)");
