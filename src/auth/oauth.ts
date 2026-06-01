/**
 * OAuth 2.0 Authentication with GitHub
 * Implements OAuth 2.0 authorization code grant flow
 */

import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { URLSearchParams } from "node:url";

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
}

interface OAuthState {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  createdAt: number;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in?: number;
  refresh_token?: string;
}

export interface UserInfo {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

export interface AuthenticatedRequest extends Request {
  user: UserInfo;
  accessToken: string;
}

// GitHub OAuth configuration
const GITHUB_OAUTH_CONFIG: OAuthConfig = {
  clientId: process.env.GITHUB_CLIENT_ID || "",
  clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  redirectUri: process.env.GITHUB_REDIRECT_URI || "http://localhost:3000/auth/callback",
  scope: "read:user user:email",
  authUrl: "https://github.com/login/oauth/authorize",
  tokenUrl: "https://github.com/login/oauth/access_token",
  userInfoUrl: "https://api.github.com/user",
};

// In-memory state storage (in production, use Redis or database)
const stateStore = new Map<string, OAuthState>();
const sessionStore = new Map<
  string,
  { accessToken: string; userInfo: UserInfo; expiresAt: number }
>();

/**
 * Generate random state string for CSRF protection
 */
function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Generate PKCE code verifier
 */
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Generate PKCE code challenge from verifier
 */
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Create OAuth state with PKCE
 */
export function createOAuthState(): OAuthState {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const oauthState: OAuthState = {
    state,
    codeVerifier,
    codeChallenge,
    createdAt: Date.now(),
  };

  // Store state (expires in 10 minutes)
  stateStore.set(state, oauthState);
  setTimeout(() => stateStore.delete(state), 10 * 60 * 1000);

  return oauthState;
}

/**
 * Validate OAuth state
 */
export function validateOAuthState(state: string): OAuthState | null {
  const oauthState = stateStore.get(state);
  if (!oauthState) {
    return null;
  }

  // Check if state is expired (10 minutes)
  if (Date.now() - oauthState.createdAt > 10 * 60 * 1000) {
    stateStore.delete(state);
    return null;
  }

  return oauthState;
}

/**
 * Generate authorization URL
 */
export function getAuthorizationUrl(state: string): string {
  const oauthState = validateOAuthState(state);
  if (!oauthState) {
    throw new Error("Invalid or expired OAuth state");
  }

  const params = new URLSearchParams({
    client_id: GITHUB_OAUTH_CONFIG.clientId,
    redirect_uri: GITHUB_OAUTH_CONFIG.redirectUri,
    scope: GITHUB_OAUTH_CONFIG.scope,
    state: state,
    response_type: "code",
    code_challenge: oauthState.codeChallenge,
    code_challenge_method: "S256",
  });

  return `${GITHUB_OAUTH_CONFIG.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string, state: string): Promise<TokenResponse> {
  const oauthState = validateOAuthState(state);
  if (!oauthState) {
    throw new Error("Invalid or expired OAuth state");
  }

  const response = await fetch(GITHUB_OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_OAUTH_CONFIG.clientId,
      client_secret: GITHUB_OAUTH_CONFIG.clientSecret,
      code,
      redirect_uri: GITHUB_OAUTH_CONFIG.redirectUri,
      code_verifier: oauthState.codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for token: ${error}`);
  }

  const tokenData = (await response.json()) as TokenResponse;

  // Clean up state
  stateStore.delete(state);

  return tokenData;
}

/**
 * Get user info from GitHub
 */
export async function getUserInfo(accessToken: string): Promise<UserInfo> {
  const response = await fetch(GITHUB_OAUTH_CONFIG.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "HUMMBL-MCP-Server",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get user info: ${error}`);
  }

  return (await response.json()) as UserInfo;
}

/**
 * Create session for authenticated user
 */
export function createSession(accessToken: string, userInfo: UserInfo): string {
  const sessionId = crypto.randomBytes(16).toString("hex");
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  sessionStore.set(sessionId, {
    accessToken,
    userInfo,
    expiresAt,
  });

  // Clean up expired sessions periodically
  setTimeout(() => sessionStore.delete(sessionId), 24 * 60 * 60 * 1000);

  return sessionId;
}

/**
 * Validate session and get user info
 */
export function validateSession(
  sessionId: string
): { userInfo: UserInfo; accessToken: string } | null {
  const session = sessionStore.get(sessionId);
  if (!session) {
    return null;
  }

  // Check if session is expired
  if (Date.now() > session.expiresAt) {
    sessionStore.delete(sessionId);
    return null;
  }

  return {
    userInfo: session.userInfo,
    accessToken: session.accessToken,
  };
}

/**
 * Middleware to check authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const sessionId = authHeader.substring(7); // Remove "Bearer "
  const session = validateSession(sessionId);

  if (!session) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  // Attach user info to request
  const authenticatedReq = req as AuthenticatedRequest;
  authenticatedReq.user = session.userInfo;
  authenticatedReq.accessToken = session.accessToken;

  next();
}

/**
 * Clean up expired states and sessions
 */
export function cleanupExpiredData(): void {
  const now = Date.now();

  // Clean up expired states
  for (const [state, oauthState] of stateStore.entries()) {
    if (now - oauthState.createdAt > 10 * 60 * 1000) {
      stateStore.delete(state);
    }
  }

  // Clean up expired sessions
  for (const [sessionId, session] of sessionStore.entries()) {
    if (now > session.expiresAt) {
      sessionStore.delete(sessionId);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredData, 60 * 60 * 1000);
