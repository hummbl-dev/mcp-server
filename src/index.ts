#!/usr/bin/env node

/**
 * HUMMBL MCP Server
 * stdio transport entry point for Claude Desktop integration
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Log to stderr (stdout is reserved for MCP protocol)
  console.error("HUMMBL MCP Server v1.0.2 running on stdio");
  console.error("Ready to serve Base120 mental models via Model Context Protocol");
}

main().catch((error) => {
  console.error("Fatal error in HUMMBL MCP Server:", error);
  process.exit(1);
});
