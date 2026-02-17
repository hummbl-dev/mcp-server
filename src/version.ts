import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type PackageJsonShape = {
  version?: string;
};

const readPackageVersion = (): string => {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = resolve(currentDir, "../package.json");

  try {
    const raw = readFileSync(packageJsonPath, "utf-8");
    const parsed = JSON.parse(raw) as PackageJsonShape;
    if (typeof parsed.version === "string" && parsed.version.length > 0) {
      return parsed.version;
    }
  } catch {
    // Fall through to environment fallback.
  }

  return process.env.npm_package_version ?? "0.0.0-unknown";
};

/**
 * Runtime version for MCP server metadata, API health, and operator banners.
 * Resolved from package.json to avoid manual drift.
 */
export const SERVER_VERSION = readPackageVersion();
