import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../..");
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8")) as {
  engines?: { node?: string };
};
const ciWorkflow = readFileSync(join(repoRoot, ".github", "workflows", "ci.yml"), "utf-8");
const releaseWorkflow = readFileSync(join(repoRoot, ".github", "workflows", "release.yml"), "utf-8");
const autoMergeWorkflow = join(repoRoot, ".github", "workflows", "dependabot-auto-merge.yml");

describe("runtime support policy", () => {
  it("declares Node 22 as the minimum supported runtime", () => {
    expect(packageJson.engines?.node).toBe(">=22.0.0");
  });

  it("does not execute CI on unsupported Node 20", () => {
    expect(ciWorkflow).toMatch(/node-version:\s*\[22\.x\]/);
    expect(ciWorkflow).not.toMatch(/20\.x/);
    expect(releaseWorkflow).not.toMatch(/20\.x/);
  });

  it("has no Dependabot auto-merge workflow", () => {
    expect(existsSync(autoMergeWorkflow)).toBe(false);
  });
});
