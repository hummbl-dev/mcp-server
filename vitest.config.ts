import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
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
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
