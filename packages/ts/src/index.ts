#!/usr/bin/env node

/**
 * HUMMBL MCP Server - Hybrid Entry Point
 *
 * Automatically detects transport mode:
 * - If stdin is a TTY (standalone): serve Streamable HTTP on port 3000
 * - If stdin is a pipe (subprocess): serve stdio (for Claude Desktop, etc.)
 *
 * This allows a single binary to serve both local (stdio) and remote (HTTP)
 * MCP clients without separate entry points.
 *
 * Usage:
 *   hummbl-mcp                    # Auto-detect (stdio if subprocess, HTTP if standalone)
 *   hummbl-mcp --stdio            # Force stdio mode
 *   hummbl-mcp --http             # Force HTTP mode (port 3000)
 *   hummbl-mcp --http --port 8080 # Force HTTP mode on custom port
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";
import { SERVER_VERSION } from "./version.js";

function parseArgs(args: string[]): { mode: "auto" | "stdio" | "http"; port: number } {
  let mode: "auto" | "stdio" | "http" = "auto";
  let port = 3000;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--stdio") mode = "stdio";
    else if (args[i] === "--http") mode = "http";
    else if (args[i] === "--port" && i + 1 < args.length) {
      port = parseInt(args[i + 1], 10) || 3000;
    }
  }
  return { mode, port };
}

async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`HUMMBL MCP Server v${SERVER_VERSION} running on stdio`);
}

async function runHttp(port: number): Promise<void> {
  const http = await import("http");
  const server = createServer();

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  const httpServer = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id");
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "healthy",
        version: SERVER_VERSION,
        transport: "streamable-http",
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    if (req.url === "/mcp") {
      // Collect request body
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          // StreamableHTTPServerTransport expects Node.js IncomingMessage/ServerResponse
          // Re-attach the parsed body so the transport can read it
          (req as any).body = body ? JSON.parse(body) : undefined;
          await transport.handleRequest(req, res);
        } catch (error) {
          console.error("MCP request error:", error);
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        }
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found", path: req.url }));
  });

  await server.connect(transport);

  httpServer.listen(port, () => {
    console.error(`HUMMBL MCP Server v${SERVER_VERSION} running on Streamable HTTP`);
    console.error(`MCP endpoint: http://localhost:${port}/mcp`);
    console.error(`Health check: http://localhost:${port}/health`);
  });
}

async function main(): Promise<void> {
  const { mode, port } = parseArgs(process.argv.slice(2));

  if (mode === "stdio") {
    await runStdio();
  } else if (mode === "http") {
    await runHttp(port);
  } else {
    // Auto-detect: if stdin is a TTY, serve HTTP; otherwise serve stdio
    if (process.stdin.isTTY) {
      console.error(`HUMMBL MCP Server v${SERVER_VERSION} — standalone mode detected, serving HTTP`);
      await runHttp(port);
    } else {
      await runStdio();
    }
  }
}

main().catch((error) => {
  console.error("Fatal error in HUMMBL MCP Server:", error);
  process.exit(1);
});
