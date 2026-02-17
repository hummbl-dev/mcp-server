import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

describe("Vitest discovery configuration contract", () => {
  it("keeps explicit include and dist exclusion patterns", () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const configPath = join(__dirname, "../../vitest.config.ts");
    const configSource = readFileSync(configPath, "utf-8");

    expect(configSource).toContain(
      'include: ["src/**/*.{test,spec}.ts", "tests/**/*.{test,spec}.ts"]'
    );
    expect(configSource).toContain('exclude: [...configDefaults.exclude, "**/dist/**"]');
  });
});
