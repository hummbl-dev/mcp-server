/**
 * Cloudflare Access JWT Verification
 *
 * Verifies the CF-Access-Jwt-Assertion header injected by Cloudflare Access
 * using the Web Crypto API (crypto.subtle). No external dependencies.
 *
 * Works in both Cloudflare Workers and Node.js 20+ (Web Crypto is global).
 *
 * IMPORTANT: Cloudflare Access groups (e.g., hummbl-mcp-write) are NOT
 * included in the JWT by default. They are only available via the
 * /cdn-cgi/access/get-identity endpoint. This module calls that endpoint
 * after JWT verification to populate the groups array.
 *
 * Reference: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/#user-identity
 */

/** Identity extracted from a verified Cloudflare Access JWT + get-identity lookup. */
export interface VerifiedIdentity {
  /** Subject — unique user identifier from the IdP */
  sub: string;
  /** User email */
  email: string;
  /** User display name (from get-identity, may be empty) */
  name: string;
  /** Cloudflare Access group names the user belongs to (from get-identity) */
  groups: string[];
  /** Token expiry (seconds since epoch) */
  exp: number;
}

interface JwtHeader {
  alg: string;
  kid: string;
  typ?: string;
}

interface AccessClaims {
  sub: string;
  email: string;
  name?: string;
  exp: number;
  aud: string | string[];
  iss: string;
  iat?: number;
}

/** Response from /cdn-cgi/access/get-identity */
interface AccessIdentityResponse {
  email?: string;
  name?: string;
  user_uuid?: string;
  groups?: Array<{ id: string; name: string }>;
  idp?: { id: string; type: string };
  geo?: { country: string };
  iat?: number;
}

interface PublicKey {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n?: string; // RSA modulus (base64url)
  e?: string; // RSA exponent (base64url)
  x?: string; // EC x coordinate
  y?: string; // EC y coordinate
  crv?: string; // EC curve
  k?: string; // HMAC key (oct)
}

interface JwksResponse {
  keys: PublicKey[];
}

/**
 * Fetch Cloudflare Access public keys from the team's certs endpoint.
 * In production, this is cached by the Workers Cache API or KV.
 * In tests, callers pass a mock `fetchImpl`.
 */
export async function fetchAccessPublicKeys(
  teamUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<Map<string, PublicKey>> {
  const certsUrl = `${teamUrl.replace(/\/$/, "")}/cdn-cgi/access/certs`;
  const response = await fetchImpl(certsUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch Access public keys: ${response.status}`);
  }
  const jwks = (await response.json()) as JwksResponse;
  const keyMap = new Map<string, PublicKey>();
  for (const key of jwks.keys) {
    if (key.kid) {
      keyMap.set(key.kid, key);
    }
  }
  return keyMap;
}

/**
 * Fetch the user's full identity (including Access groups) from the
 * /cdn-cgi/access/get-identity endpoint.
 *
 * Cloudflare Access groups are NOT included in the JWT by default.
 * They must be fetched separately via this endpoint.
 *
 * The JWT is passed as the CF_Authorization cookie, per Cloudflare docs.
 *
 * @param jwt - The raw JWT string from CF-Access-Jwt-Assertion header
 * @param teamUrl - Cloudflare Access team URL
 * @param fetchImpl - Optional fetch override for testing
 * @returns AccessIdentityResponse if successful, null if the lookup fails
 */
export async function fetchAccessIdentity(
  jwt: string,
  teamUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<AccessIdentityResponse | null> {
  try {
    const identityUrl = `${teamUrl.replace(/\/$/, "")}/cdn-cgi/access/get-identity`;
    const response = await fetchImpl(identityUrl, {
      headers: { cookie: `CF_Authorization=${jwt}` },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as AccessIdentityResponse;
  } catch {
    return null;
  }
}

/**
 * Parse a JWT (header.payload.signature) without verification.
 * Returns the decoded header and claims.
 */
function parseJwtParts(jwt: string): {
  header: JwtHeader;
  claims: AccessClaims;
  signature: Uint8Array;
  signingInput: Uint8Array;
} {
  const parts = jwt.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format: expected 3 parts");
  }

  const header = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0]))) as JwtHeader;
  const claims = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1]))) as AccessClaims;
  const signature = base64urlDecode(parts[2]);
  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);

  return { header, claims, signature, signingInput };
}

/**
 * Decode a base64url string to Uint8Array.
 * Handles both padded and unpadded base64url.
 */
function base64urlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const b64 = pad ? padded + "=".repeat(4 - pad) : padded;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Import a JWK public key into a Web Crypto Key object for verification.
 */
async function importPublicKey(key: PublicKey): Promise<CryptoKey> {
  const algorithm: Record<string, unknown> =
    key.alg === "RS256"
      ? { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }
      : key.alg === "ES256"
        ? { name: "ECDSA", namedCurve: "P-256" }
        : { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };

  // Build the JWK import format
  const jwk: JsonWebKey = {
    kty: key.kty,
    alg: key.alg,
    ext: true,
  };
  if (key.n) jwk.n = key.n;
  if (key.e) jwk.e = key.e;
  if (key.x) jwk.x = key.x;
  if (key.y) jwk.y = key.y;
  if (key.crv) jwk.crv = key.crv;

  return crypto.subtle.importKey("jwk", jwk, algorithm as any, false, ["verify"]);
}

/**
 * Verify a Cloudflare Access JWT and extract the authenticated identity.
 *
 * This function:
 * 1. Verifies the JWT signature using Cloudflare's public keys
 * 2. Checks expiry and audience
 * 3. Calls /cdn-cgi/access/get-identity to fetch the user's Access groups
 *    (groups are NOT in the JWT by default — they must be fetched separately)
 *
 * @param jwt - The raw JWT string from CF-Access-Jwt-Assertion header
 * @param audience - The expected audience (CF Access audience tag for this Worker)
 * @param teamUrl - Cloudflare Access team URL (e.g., https://hummbl.cloudflareaccess.com)
 * @param fetchImpl - Optional fetch override for testing
 * @returns VerifiedIdentity if valid, null if invalid/expired/wrong-audience
 */
export async function verifyCloudflareAccessJwt(
  jwt: string,
  audience: string,
  teamUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<VerifiedIdentity | null> {
  try {
    const { header, claims, signature, signingInput } = parseJwtParts(jwt);

    // 1. Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp && claims.exp < now) {
      return null;
    }

    // 2. Check audience
    const tokenAudience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!tokenAudience.includes(audience)) {
      return null;
    }

    // 3. Fetch public keys and find matching key
    const keyMap = await fetchAccessPublicKeys(teamUrl, fetchImpl);
    const publicKey = keyMap.get(header.kid);
    if (!publicKey) {
      return null;
    }

    // 4. Verify signature
    const cryptoKey = await importPublicKey(publicKey);
    const algorithm =
      publicKey.alg === "ES256"
        ? { name: "ECDSA", hash: "SHA-256" }
        : { name: "RSASSA-PKCS1-v1_5" };

    const valid = await crypto.subtle.verify(algorithm, cryptoKey, signature, signingInput);

    if (!valid) {
      return null;
    }

    // 5. Fetch full identity (including Access groups) from get-identity endpoint
    //    Groups are NOT in the JWT by default — they must be fetched separately.
    //    If get-identity fails, we still return the identity with empty groups
    //    (user gets read-only profile — fail safe, not fail open).
    const identity = await fetchAccessIdentity(jwt, teamUrl, fetchImpl);
    const groupNames = identity?.groups?.map((g) => g.name) || [];
    const name = identity?.name || claims.email || "";

    // 6. Return verified identity with groups from get-identity
    return {
      sub: claims.sub,
      email: claims.email,
      name,
      groups: groupNames,
      exp: claims.exp,
    };
  } catch {
    // Any parsing or verification error = invalid token
    return null;
  }
}

/**
 * Extract the JWT from the CF-Access-Jwt-Assertion header.
 * Returns null if the header is missing or empty.
 */
export function extractAccessJwt(request: Request): string | null {
  const jwt = request.headers.get("CF-Access-Jwt-Assertion");
  if (!jwt || jwt.trim().length === 0) {
    return null;
  }
  return jwt;
}
