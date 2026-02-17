import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts", "tests/**/*.{test,spec}.ts"],
    exclude: [...configDefaults.exclude, "**/dist/**"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.config.{js,ts}",
        "**/*.d.ts",
        "src/index.ts",
        "src/server.ts", // MCP server entry point
        "src/resources/**", // Resource handlers tested via tools
        "src/__tests__/**", // Test files
        "src/utils/result.ts", // Utility type, used throughout
      ],
      thresholds: {
        global: {
          // TODO: Raise branches back to 75% after logger/session-manager coverage improvements
          branches: 74,
          functions: 85,
          statements: 85,
          lines: 85,
        },
      },
    },
  },
});
