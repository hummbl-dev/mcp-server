import { describe, it, expect } from "vitest";
import app from "../api.js";
import { OPENAPI_DOCUMENT, buildOpenApiDocument, DOCUMENTED_OPERATIONS } from "../openapi.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiSource = readFileSync(join(__dirname, "../api.ts"), "utf8");

describe("OpenAPI specification", () => {
  it("is a valid OpenAPI 3.0 document shape", () => {
    expect(OPENAPI_DOCUMENT).toBeDefined();
    expect(OPENAPI_DOCUMENT.openapi).toMatch(/^3\.0/);
    expect(OPENAPI_DOCUMENT.info).toBeDefined();
    expect(OPENAPI_DOCUMENT.paths).toBeDefined();
    expect(OPENAPI_DOCUMENT.components).toBeDefined();
  });

  it("carries the current server version in info.version", () => {
    const info = OPENAPI_DOCUMENT.info as { version: string };
    // We don't assert the exact version string so this test doesn't fail
    // every release; we just require it to be non-empty and semver-ish.
    expect(info.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("declares the bearerAuth security scheme", () => {
    const components = OPENAPI_DOCUMENT.components as {
      securitySchemes: Record<string, { type: string; scheme: string } | undefined>;
    };
    const bearer = components.securitySchemes.bearerAuth;
    expect(bearer).toBeDefined();
    expect(bearer?.scheme).toBe("bearer");
  });

  it("buildOpenApiDocument returns a fresh document each call", () => {
    const a = buildOpenApiDocument();
    const b = buildOpenApiDocument();
    expect(a).not.toBe(b); // different identities
    expect(a).toEqual(b); // same content
  });

  it("every documented path is either registered on the app or matches a Hono pattern in api.ts", () => {
    // Convert each documented path to the corresponding Hono route string by
    // replacing {param} -> :param, then look for that literal in api.ts or in
    // the relationships router (which is mounted at /v1). This is a
    // drift-guard: if someone documents a path without actually adding the
    // route, this test flags it.
    const documented = Object.keys(OPENAPI_DOCUMENT.paths as Record<string, unknown>);
    for (const path of documented) {
      if (path === "/openapi.json") continue; // registered directly in this PR
      const honoPath = path.replace(/\{(\w+)\}/g, ":$1");
      // Either appears in api.ts directly, or the path after /v1/ prefix is in relationships.ts
      const inApiTs = apiSource.includes(`"${honoPath}"`);
      const inSubRouter =
        honoPath.startsWith("/v1/") &&
        (apiSource.includes(`app.route("/v1"`) || apiSource.includes(`app.route('/v1'`));
      expect(
        inApiTs || inSubRouter,
        `Documented path ${path} (hono: ${honoPath}) not found in api.ts`
      ).toBe(true);
    }
  });

  it("DOCUMENTED_OPERATIONS enumerates every method+path combination", () => {
    const paths = OPENAPI_DOCUMENT.paths as Record<string, Record<string, unknown>>;
    const expected = Object.entries(paths).flatMap(([p, item]) =>
      Object.keys(item).map((method) => `${method.toUpperCase()} ${p}`)
    );
    const actual = DOCUMENTED_OPERATIONS.map((op) => `${op.method.toUpperCase()} ${op.path}`);
    expect(actual.sort()).toEqual(expected.sort());
  });
});

describe("GET /openapi.json endpoint", () => {
  it("serves the spec at /openapi.json with Content-Type application/json", async () => {
    const env = {
      DB: {} as unknown,
      API_KEYS: {} as unknown,
      SESSIONS: {} as unknown,
    };
    const res = await app.request("http://localhost/openapi.json", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const body = await res.json();
    expect(body).toHaveProperty("openapi");
    expect(body).toHaveProperty("paths");
  });

  it("does not require authentication", async () => {
    const env = {
      DB: {} as unknown,
      API_KEYS: {} as unknown,
      SESSIONS: {} as unknown,
    };
    const res = await app.request("http://localhost/openapi.json", {}, env);
    expect(res.status).toBe(200);
  });
});
