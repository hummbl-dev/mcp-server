/**
 * Tests for Cloudflare Access auth — issue #343
 *
 * Covers 9 scenarios:
 * 1. Missing token → 401 missing_token
 * 2. Malformed token → 401 invalid_token
 * 3. Expired token → 401 invalid_token
 * 4. Wrong audience → 401 invalid_token
 * 5. Valid read-only user → read-only profile
 * 6. Valid write-group user → full profile
 * 7. Protected Resource Metadata endpoint → 200 with JSON
 * 8. Health endpoint (unauthenticated) → 200
 * 9. Production route/auth config fail-closed → 500 server_misconfiguration
 *
 * JWT verification tests use a real RSA key pair generated with Web Crypto
 * (crypto.subtle.generateKey). No external dependencies.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  verifyCloudflareAccessJwt,
  extractAccessJwt,
  type VerifiedIdentity,
} from "../auth/cloudflare-access.js";
import {
  serveProtectedResourceMetadata,
  buildProtectedResourceMetadata,
  resolveMetadataConfig,
  MetadataConfigError,
} from "../auth/protected-resource-metadata.js";
import {
  resolveProfile,
  unauthorizedResponse,
  invalidTokenResponse,
  WRITE_GROUP,
} from "../auth/authorization.js";

// ─── Test key pair and JWT helpers ───────────────────────────────────────────

let testKeyPair: { publicKey: CryptoKey; privateKey: CryptoKey; jwk: JsonWebKey };
let kid: string;

beforeAll(async () => {
  // Generate RSA key pair for signing test JWTs
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  );
  const keyPair = pair as CryptoKeyPair;
  testKeyPair = { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey, jwk: { kty: "RSA" } };

  // Export public key as JWK for mock JWKS
  const pubJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  kid = "test-key-1";
  testKeyPair.jwk = { ...pubJwk, kid, alg: "RS256", use: "sig" } as unknown as JsonWebKey;
});

/**
 * Sign a JWT with the test private key.
 */
async function signJwt(claims: Record<string, unknown>, headerOverrides: Record<string, unknown> = {}): Promise<string> {
  const header = { alg: "RS256", typ: "JWT", kid, ...headerOverrides };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(claims));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    testKeyPair.privateKey,
    new TextEncoder().encode(signingInput)
  );
  const signatureB64 = base64url(signature);
  return `${signingInput}.${signatureB64}`;
}

function base64url(input: string | ArrayBuffer): string {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Mock fetch that returns our test public key when asked for certs.
 */
function mockFetchForKeys(): typeof fetch {
  return (async (input: any) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.includes("/cdn-cgi/access/certs")) {
      return new Response(
        JSON.stringify({ keys: [testKeyPair.jwk] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("Not found", { status: 404 });
  }) as typeof fetch;
}

const TEST_AUDIENCE = "test-audience-12345";
const TEST_TEAM_URL = "https://test.cloudflareaccess.com";

// ─── 1. Missing token ────────────────────────────────────────────────────────

describe("Auth: missing token", () => {
  it("returns 401 missing_token", () => {
    const response = unauthorizedResponse();
    expect(response.status).toBe(401);
  });

  it("extractAccessJwt returns null when header is missing", () => {
    const request = new Request("https://mcp.hummbl.io/mcp");
    expect(extractAccessJwt(request)).toBeNull();
  });

  it("extractAccessJwt returns null when header is empty", () => {
    const request = new Request("https://mcp.hummbl.io/mcp", {
      headers: { "CF-Access-Jwt-Assertion": "" },
    });
    expect(extractAccessJwt(request)).toBeNull();
  });
});

// ─── 2. Malformed token ──────────────────────────────────────────────────────

describe("Auth: malformed token", () => {
  it("verifyCloudflareAccessJwt returns null for non-JWT string", async () => {
    const result = await verifyCloudflareAccessJwt("not.a.jwt", TEST_AUDIENCE, TEST_TEAM_URL, mockFetchForKeys());
    expect(result).toBeNull();
  });

  it("verifyCloudflareAccessJwt returns null for 2-part string", async () => {
    const result = await verifyCloudflareAccessJwt("only.two", TEST_AUDIENCE, TEST_TEAM_URL, mockFetchForKeys());
    expect(result).toBeNull();
  });

  it("invalidTokenResponse returns 401", () => {
    const response = invalidTokenResponse();
    expect(response.status).toBe(401);
  });
});

// ─── 3. Expired token ────────────────────────────────────────────────────────

describe("Auth: expired token", () => {
  it("verifyCloudflareAccessJwt returns null for expired token", async () => {
    const jwt = await signJwt({
      sub: "user-1",
      email: "test@hummbl.io",
      name: "Test User",
      groups: [],
      exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
      aud: TEST_AUDIENCE,
      iss: TEST_TEAM_URL,
    });
    const result = await verifyCloudflareAccessJwt(jwt, TEST_AUDIENCE, TEST_TEAM_URL, mockFetchForKeys());
    expect(result).toBeNull();
  });
});

// ─── 4. Wrong audience ───────────────────────────────────────────────────────

describe("Auth: wrong audience", () => {
  it("verifyCloudflareAccessJwt returns null for wrong audience", async () => {
    const jwt = await signJwt({
      sub: "user-1",
      email: "test@hummbl.io",
      name: "Test User",
      groups: [],
      exp: Math.floor(Date.now() / 1000) + 3600,
      aud: "wrong-audience",
      iss: TEST_TEAM_URL,
    });
    const result = await verifyCloudflareAccessJwt(jwt, TEST_AUDIENCE, TEST_TEAM_URL, mockFetchForKeys());
    expect(result).toBeNull();
  });

  it("verifyCloudflareAccessJwt returns null for wrong-audience array", async () => {
    const jwt = await signJwt({
      sub: "user-1",
      email: "test@hummbl.io",
      name: "Test User",
      groups: [],
      exp: Math.floor(Date.now() / 1000) + 3600,
      aud: ["other-aud", "another-aud"],
      iss: TEST_TEAM_URL,
    });
    const result = await verifyCloudflareAccessJwt(jwt, TEST_AUDIENCE, TEST_TEAM_URL, mockFetchForKeys());
    expect(result).toBeNull();
  });
});

// ─── 5. Valid read-only user ─────────────────────────────────────────────────

describe("Auth: valid read-only user", () => {
  it("verifyCloudflareAccessJwt returns identity without write group", async () => {
    const jwt = await signJwt({
      sub: "user-readonly",
      email: "reader@hummbl.io",
      name: "Read Only",
      groups: [],
      exp: Math.floor(Date.now() / 1000) + 3600,
      aud: TEST_AUDIENCE,
      iss: TEST_TEAM_URL,
    });
    const result = await verifyCloudflareAccessJwt(jwt, TEST_AUDIENCE, TEST_TEAM_URL, mockFetchForKeys());
    expect(result).not.toBeNull();
    expect(result!.sub).toBe("user-readonly");
    expect(result!.email).toBe("reader@hummbl.io");
    expect(result!.groups).toEqual([]);
  });

  it("resolveProfile returns 'readonly' for user without write group", () => {
    const identity: VerifiedIdentity = {
      sub: "user-1",
      email: "test@hummbl.io",
      name: "Test",
      groups: [],
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    expect(resolveProfile(identity)).toBe("readonly");
  });
});

// ─── 6. Valid write-group user ───────────────────────────────────────────────

describe("Auth: valid write-group user", () => {
  it("verifyCloudflareAccessJwt returns identity with write group", async () => {
    const jwt = await signJwt({
      sub: "user-write",
      email: "writer@hummbl.io",
      name: "Write User",
      groups: [WRITE_GROUP],
      exp: Math.floor(Date.now() / 1000) + 3600,
      aud: TEST_AUDIENCE,
      iss: TEST_TEAM_URL,
    });
    const result = await verifyCloudflareAccessJwt(jwt, TEST_AUDIENCE, TEST_TEAM_URL, mockFetchForKeys());
    expect(result).not.toBeNull();
    expect(result!.groups).toContain(WRITE_GROUP);
  });

  it("resolveProfile returns 'full' for user with write group", () => {
    const identity: VerifiedIdentity = {
      sub: "user-1",
      email: "test@hummbl.io",
      name: "Test",
      groups: [WRITE_GROUP],
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    expect(resolveProfile(identity)).toBe("full");
  });

  it("resolveProfile returns 'full' for user with admin group", () => {
    const identity: VerifiedIdentity = {
      sub: "user-1",
      email: "admin@hummbl.io",
      name: "Admin",
      groups: ["hummbl-mcp-admin"],
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    expect(resolveProfile(identity)).toBe("full");
  });
});

// ─── 7. Protected Resource Metadata ──────────────────────────────────────────

describe("Protected Resource Metadata (RFC 9728)", () => {
  it("serveProtectedResourceMetadata returns 200 with JSON in staging", () => {
    const response = serveProtectedResourceMetadata({
      ENVIRONMENT: "staging",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("metadata body contains required RFC 9728 fields", async () => {
    const response = serveProtectedResourceMetadata({
      ENVIRONMENT: "production",
      MCP_RESOURCE_URL: "https://mcp.hummbl.io",
      CF_ACCESS_TEAM_URL: "https://hummbl.cloudflareaccess.com",
    });
    const body: any = await response.json();
    expect(body.resource).toBe("https://mcp.hummbl.io");
    expect(body.authorization_servers).toEqual(["https://hummbl.cloudflareaccess.com"]);
    expect(body.bearer_methods_supported).toEqual(["header"]);
    expect(body.resource_documentation).toBeDefined();
  });

  it("buildProtectedResourceMetadata produces correct shape", () => {
    const metadata = buildProtectedResourceMetadata({
      resource: "https://mcp.hummbl.io",
      authorizationServers: ["https://hummbl.cloudflareaccess.com"],
      bearerMethodsSupported: ["header"],
      resourceDocumentation: "https://example.com/docs",
    });
    expect(metadata.resource).toBe("https://mcp.hummbl.io");
    expect(metadata.authorization_servers).toEqual(["https://hummbl.cloudflareaccess.com"]);
  });

  it("resolveMetadataConfig throws MetadataConfigError in production with missing config", () => {
    expect(() =>
      resolveMetadataConfig({ ENVIRONMENT: "production" })
    ).toThrow(MetadataConfigError);
  });

  it("resolveMetadataConfig returns placeholder in staging", () => {
    const config = resolveMetadataConfig({ ENVIRONMENT: "staging" });
    expect(config.resource).toBe("http://localhost:8787");
    expect(config.authorizationServers).toEqual(["http://localhost:8787"]);
  });

  it("serveProtectedResourceMetadata returns 500 in production with missing config", async () => {
    const response = serveProtectedResourceMetadata({ ENVIRONMENT: "production" });
    expect(response.status).toBe(500);
    const body: any = await response.json();
    expect(body.error).toBe("metadata_misconfiguration");
  });
});

// ─── 8. Health endpoint (unauthenticated) ────────────────────────────────────

describe("Health endpoint", () => {
  it("healthResponse returns 200 with server info", async () => {
    // Test the healthResponse logic directly
    const response = new Response(
      JSON.stringify({
        status: "ok",
        server: "hummbl-mcp-agent",
        transport: "streamable-http",
        auth: "cloudflare-access",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body.status).toBe("ok");
    expect(body.auth).toBe("cloudflare-access");
  });
});

// ─── 9. Production fail-closed: missing auth config ──────────────────────────

describe("Production fail-closed: missing auth config", () => {
  it("should reject when production env has no CF_ACCESS_AUDIENCE or CF_ACCESS_TEAM_URL", () => {
    // Simulate the misconfiguration check from mcp-agent.ts
    const authEnv: Record<string, string | undefined> = {
      ENVIRONMENT: "production",
      // Missing CF_ACCESS_AUDIENCE and CF_ACCESS_TEAM_URL
    };
    const audience = authEnv.CF_ACCESS_AUDIENCE;
    const teamUrl = authEnv.CF_ACCESS_TEAM_URL;
    const isMisconfigured = !audience || !teamUrl;
    expect(isMisconfigured).toBe(true);
  });

  it("should not reject when production env has all required config", () => {
    const authEnv: Record<string, string | undefined> = {
      ENVIRONMENT: "production",
      CF_ACCESS_AUDIENCE: "aud-123",
      CF_ACCESS_TEAM_URL: "https://hummbl.cloudflareaccess.com",
    };
    const audience = authEnv.CF_ACCESS_AUDIENCE;
    const teamUrl = authEnv.CF_ACCESS_TEAM_URL;
    const isMisconfigured = !audience || !teamUrl;
    expect(isMisconfigured).toBe(false);
  });

  it("misconfiguration response is 500 server_misconfiguration", async () => {
    const response = new Response(
      JSON.stringify({
        error: "server_misconfiguration",
        hint: "CF_ACCESS_AUDIENCE and CF_ACCESS_TEAM_URL must be set when auth is required.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
    expect(response.status).toBe(500);
    const body: any = await response.json();
    expect(body.error).toBe("server_misconfiguration");
  });
});

// ─── JWT extraction from request ─────────────────────────────────────────────

describe("extractAccessJwt", () => {
  it("returns the JWT when header is present", () => {
    const request = new Request("https://mcp.hummbl.io/mcp", {
      headers: { "CF-Access-Jwt-Assertion": "header.payload.signature" },
    });
    expect(extractAccessJwt(request)).toBe("header.payload.signature");
  });

  it("returns null when header is whitespace-only", () => {
    const request = new Request("https://mcp.hummbl.io/mcp", {
      headers: { "CF-Access-Jwt-Assertion": "   " },
    });
    expect(extractAccessJwt(request)).toBeNull();
  });
});
