import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { createServer } from "../server.js";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf-8")
);
const packageVersion: string = packageJson.version;

const getServerVersion = (): string => {
  const server = createServer();
  const internalServer = server.server as unknown as { _serverInfo: { version: string } };
  return internalServer._serverInfo.version;
};

describe("Server version contract", () => {
  it("ensures createServer metadata matches package.json version", () => {
    expect(getServerVersion()).toBe(packageVersion);
  });

  it("ensures index banner string stays in sync with package.json version", () => {
    const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf-8");
    const expectedBanner = `HUMMBL MCP Server v${packageVersion} running on stdio`;
    expect(indexSource.includes(expectedBanner)).toBe(true);
  });
});
