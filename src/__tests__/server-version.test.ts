import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import app from "../api.js";
import { createServer } from "../server.js";
import { SERVER_VERSION } from "../version.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8"));
const packageVersion: string = packageJson.version;

const getServerVersion = (): string => {
  const server = createServer();
  const internalServer = server.server as unknown as { _serverInfo: { version: string } };
  return internalServer._serverInfo.version;
};

describe("Server version contract", () => {
  it("ensures shared runtime version constant matches package.json version", () => {
    expect(SERVER_VERSION).toBe(packageVersion);
  });

  it("ensures createServer metadata matches package.json version", () => {
    expect(getServerVersion()).toBe(SERVER_VERSION);
  });

  it("ensures index banner string stays in sync with package.json version", () => {
    // Read from src directory (works whether test runs from src or dist)
    const srcDir = __dirname.includes("/dist/")
      ? join(__dirname, "../../src/index.ts")
      : join(__dirname, "../index.ts");
    const indexSource = readFileSync(srcDir, "utf-8");
    const expectedResolvedBanner = `HUMMBL MCP Server v${SERVER_VERSION} running on stdio`;
    const expectedTemplateBanner = "HUMMBL MCP Server v${SERVER_VERSION} running on stdio";
    expect(
      indexSource.includes(expectedResolvedBanner) || indexSource.includes(expectedTemplateBanner)
    ).toBe(true);
  });

  it("ensures /health endpoint version stays in sync with package.json version", async () => {
    const response = await app.request("http://localhost/health");
    expect(response.status).toBe(200);

    const body = (await response.json()) as { version: string };
    expect(body.version).toBe(SERVER_VERSION);
  });
});
