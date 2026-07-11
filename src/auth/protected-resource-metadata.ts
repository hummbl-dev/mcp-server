/**
 * RFC 9728 Protected Resource Metadata
 *
 * Serves the /.well-known/oauth-protected-resource endpoint that tells
 * MCP clients where to obtain access tokens for this resource server.
 *
 * All fields are environment-derived. In production, if required config
 * is missing, the endpoint fails closed with a 500 error rather than
 * serving incorrect metadata.
 */

export interface ProtectedResourceMetadataConfig {
  /** The resource server's URL (e.g., https://mcp.hummbl.io) */
  resource: string;
  /** Authorization server URL(s) — Cloudflare Access team URL */
  authorizationServers: string[];
  /** Bearer token delivery methods supported */
  bearerMethodsSupported: string[];
  /** Documentation URL for this resource */
  resourceDocumentation: string;
}

/**
 * Build the Protected Resource Metadata response body per RFC 9728.
 */
export function buildProtectedResourceMetadata(
  config: ProtectedResourceMetadataConfig
): Record<string, unknown> {
  return {
    resource: config.resource,
    authorization_servers: config.authorizationServers,
    bearer_methods_supported: config.bearerMethodsSupported,
    resource_documentation: config.resourceDocumentation,
  };
}

/**
 * Configuration error — thrown when required env vars are missing
 * in production mode. This makes misconfiguration obvious rather
 * than silently serving wrong issuer/resource values.
 */
export class MetadataConfigError extends Error {
  constructor(missing: string[]) {
    super(
      `Protected Resource Metadata misconfiguration: missing ${missing.join(", ")}. ` +
        `Set these environment variables or secrets before enabling the production route.`
    );
    this.name = "MetadataConfigError";
  }
}

/**
 * Resolve Protected Resource Metadata config from environment.
 *
 * In production: all fields are required. Missing fields throw MetadataConfigError.
 * In staging/dev: falls back to placeholder values so the endpoint can be tested.
 */
export function resolveMetadataConfig(
  env: Record<string, string | undefined>
): ProtectedResourceMetadataConfig {
  const isProduction = env.ENVIRONMENT === "production";

  const resource = env.MCP_RESOURCE_URL;
  const authServer = env.CF_ACCESS_TEAM_URL;
  const docs =
    env.MCP_AUTH_DOCS_URL || "https://github.com/hummbl-dev/mcp-server/blob/main/docs/auth.md";

  if (isProduction) {
    const missing: string[] = [];
    if (!resource) missing.push("MCP_RESOURCE_URL");
    if (!authServer) missing.push("CF_ACCESS_TEAM_URL");
    if (missing.length > 0) {
      throw new MetadataConfigError(missing);
    }
  }

  return {
    resource: resource || "http://localhost:8787",
    authorizationServers: authServer ? [authServer] : ["http://localhost:8787"],
    bearerMethodsSupported: ["header"],
    resourceDocumentation: docs,
  };
}

/**
 * Serve the /.well-known/oauth-protected-resource endpoint.
 *
 * Returns a Response with the metadata JSON, or a 500 if misconfigured
 * in production.
 */
export function serveProtectedResourceMetadata(env: Record<string, string | undefined>): Response {
  try {
    const config = resolveMetadataConfig(env);
    const metadata = buildProtectedResourceMetadata(config);
    return new Response(JSON.stringify(metadata, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message =
      err instanceof MetadataConfigError
        ? err.message
        : "Failed to build Protected Resource Metadata";
    return new Response(JSON.stringify({ error: "metadata_misconfiguration", message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
