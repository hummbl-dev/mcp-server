/**
 * HUMMBL MCP HTTP Server
 * Streamable HTTP transport entry point for ChatGPT Developer Mode integration
 *
 * Reuses the shared createServer() factory from server.ts so that
 * Claude Desktop (stdio) and ChatGPT (HTTP) share the same tool set.
 *
 * Usage:
 *   npm run dev:chatgpt        # local development
 *   npm run start:chatgpt     # production build
 *
 * Then tunnel the port and connect ChatGPT Developer Mode to:
 *   https://<tunnel-host>/mcp
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "./server.js";
import { SERVER_VERSION } from "./version.js";

const PORT = process.env.MCP_HTTP_PORT ? parseInt(process.env.MCP_HTTP_PORT, 10) : 3001;

const app = new Hono();

// Enable CORS for ChatGPT and tunnel origins
app.use(
  "*",
  cors({
    origin: "*",
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
    timestamp: new Date().toISOString(),
  })
);

// MCP Streamable HTTP endpoint (stateless — fresh transport per request)
app.all("/mcp", async (c) => {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: no session IDs
  });
  const server = createServer();
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
console.error("Ready for ChatGPT Developer Mode connection (tunnel required for HTTPS)");
