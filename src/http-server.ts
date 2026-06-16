#!/usr/bin/env node

/**
 * HUMMBL MCP Server - HTTP/SSE Transport
 * HTTP entry point for remote MCP server submission
 */

import express from "express";
import rateLimit from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer } from "./server.js";
import { SERVER_VERSION } from "./version.js";
import {
  type AuthenticatedRequest,
  createOAuthState,
  getAuthorizationUrl,
  exchangeCodeForToken,
  getUserInfo,
  createSession,
  requireAuth,
} from "./auth/oauth.js";

const app = express();
const PORT = process.env.PORT || 3000;
const transports = new Map<string, SSEServerTransport>();

// Capacity limits for self-hosted deployment
const MAX_CONCURRENT = 200;
let activeConnections = 0;

// Rate limiting per IP (100 requests per minute)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: { error: "Too many requests from this IP" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Connection limiter (prevent overload)
const connectionLimiter = (_req: Request, res: Response, next: NextFunction): void => {
  if (activeConnections >= MAX_CONCURRENT) {
    res.status(503).json({
      error: "Server at capacity",
      message: "Try again later",
      capacity: MAX_CONCURRENT,
    });
    return;
  }
  activeConnections++;
  res.on("close", () => {
    activeConnections--;
  });
  next();
};

// Enable CORS for all routes
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

// Apply rate limiting and connection limiting
app.use(limiter);
app.use(connectionLimiter);

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    version: SERVER_VERSION,
    transport: "http/sse",
    authentication: "oauth2",
    timestamp: new Date().toISOString(),
    capacity: {
      max_concurrent: MAX_CONCURRENT,
      active_connections: activeConnections,
      capacity_percent: Math.round((activeConnections / MAX_CONCURRENT) * 100),
    },
  });
});

// OAuth endpoints

// Start OAuth flow
app.get("/auth/login", (_req, res) => {
  try {
    const oauthState = createOAuthState();
    const authUrl = getAuthorizationUrl(oauthState.state);

    res.json({
      authUrl,
      state: oauthState.state,
    });
  } catch (error) {
    console.error("OAuth login error:", error);
    res.status(500).json({ error: "Failed to initiate OAuth flow" });
  }
});

// OAuth callback
app.get("/auth/callback", async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      res.status(400).json({ error: "Missing code or state parameter" });
      return;
    }

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(code as string, state as string);

    // Get user info
    const userInfo = await getUserInfo(tokenData.access_token);

    // Create session
    const sessionId = createSession(tokenData.access_token, userInfo);

    res.json({
      success: true,
      sessionId,
      user: {
        id: userInfo.id,
        login: userInfo.login,
        name: userInfo.name,
        email: userInfo.email,
      },
    });
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.status(500).json({ error: "Failed to complete OAuth flow" });
  }
});

// SSE endpoint for MCP protocol (requires authentication)
app.get("/sse", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const server = createServer();
  const transport = new SSEServerTransport("/message", res);

  transports.set(transport.sessionId, transport);
  transport.onclose = () => {
    transports.delete(transport.sessionId);
    console.error(
      `HUMMBL MCP Server v${SERVER_VERSION} - SSE connection closed from ${authReq.ip} for user ${authReq.user.login}`
    );
  };
  transport.onerror = (error) => {
    console.error(
      `HUMMBL MCP Server v${SERVER_VERSION} - SSE transport error for user ${authReq.user.login}:`,
      error
    );
    transports.delete(transport.sessionId);
  };

  await server.connect(transport);

  console.error(
    `HUMMBL MCP Server v${SERVER_VERSION} - SSE connection established from ${authReq.ip} for user ${authReq.user.login}`
  );
});

// Message endpoint for POST requests (requires authentication)
app.post("/message", requireAuth, async (req, res) => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(404).json({ error: "Unknown or expired SSE session" });
    return;
  }

  try {
    await transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    console.error("Failed to handle MCP message:", error);
  }
});

// Start server
app.listen(PORT, () => {
  console.error(`HUMMBL MCP Server v${SERVER_VERSION} running on HTTP/SSE with OAuth 2.0`);
  console.error(`Server listening on port ${PORT}`);
  console.error(`OAuth login: http://localhost:${PORT}/auth/login`);
  console.error(`OAuth callback: http://localhost:${PORT}/auth/callback`);
  console.error(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.error(`Message endpoint: http://localhost:${PORT}/message`);
  console.error(`Health check: http://localhost:${PORT}/health`);
  console.error(`\nRequired environment variables:`);
  console.error(`- GITHUB_CLIENT_ID`);
  console.error(`- GITHUB_CLIENT_SECRET`);
  console.error(`- GITHUB_REDIRECT_URI`);
});
