/**
 * Gate-Check Protocol Tests
 *
 * Validates the gate-check protocol defined in GATE_CHECK_PROTOCOL.md and
 * implemented by gate-check.sh. Ensures the protocol document has all
 * required categories, the automation script contains all required checks,
 * and the two stay in sync.
 *
 * Fixes #233
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../..");
const gateCheckScriptPath = join(repoRoot, "gate-check.sh");
const gateCheckDocPath = join(repoRoot, "GATE_CHECK_PROTOCOL.md");

const gateCheckScript = existsSync(gateCheckScriptPath)
  ? readFileSync(gateCheckScriptPath, "utf-8")
  : "";

const gateCheckDoc = existsSync(gateCheckDocPath) ? readFileSync(gateCheckDocPath, "utf-8") : "";

/**
 * The 10 categories defined in the Gate Check Protocol's Decision Matrix.
 */
const REQUIRED_CATEGORIES = [
  "Code Quality",
  "Testing",
  "Documentation",
  "User Experience",
  "Technical Debt",
  "Dependencies",
  "Performance",
  "Security",
  "Observability",
  "Deployment",
] as const;

/**
 * The npm scripts that gate-check.sh must invoke (as run_check commands).
 */
const REQUIRED_SCRIPT_CHECKS = [
  { name: "TypeScript compilation", script: "npm run typecheck" },
  { name: "Linting", script: "npm run lint" },
  { name: "Code formatting", script: "npm run format:check" },
  { name: "Test suite", script: "npm test" },
  { name: "Production build", script: "npm run build" },
] as const;

describe("Gate-Check Protocol", () => {
  // -----------------------------------------------------------------------
  // File existence
  // -----------------------------------------------------------------------

  describe("file existence", () => {
    it("gate-check.sh exists in the repo root", () => {
      expect(existsSync(gateCheckScriptPath)).toBe(true);
    });

    it("GATE_CHECK_PROTOCOL.md exists in the repo root", () => {
      expect(existsSync(gateCheckDocPath)).toBe(true);
    });

    it("gate-check.sh is a bash script (shebang line)", () => {
      expect(gateCheckScript.startsWith("#!/bin/bash")).toBe(true);
    });

    it("gate-check.sh is executable", () => {
      // On Windows, the filesystem doesn't track Unix execute bits.
      // Use git's file mode (100755 = executable) as the source of truth.
      const isWindows = process.platform === "win32";
      if (isWindows) {
        const gitMode = execSync("git ls-files -s gate-check.sh", {
          cwd: repoRoot,
          encoding: "utf-8",
        }).trim();
        // git ls-files -s output: "100755 <hash> 0\tgate-check.sh"
        expect(gitMode.startsWith("100755")).toBe(true);
      } else {
        const stats = statSync(gateCheckScriptPath);
        // Check if any execute bit is set (owner, group, or others).
        const isExecutable = Boolean(stats.mode & 0o111);
        expect(isExecutable).toBe(true);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Protocol document structure
  // -----------------------------------------------------------------------

  describe("GATE_CHECK_PROTOCOL.md structure", () => {
    it("has a title and purpose statement", () => {
      expect(gateCheckDoc).toContain("# Gate Check Protocol");
      expect(gateCheckDoc).toContain("Purpose");
    });

    it("documents when to run the gate check", () => {
      expect(gateCheckDoc).toContain("When to Run");
    });

    it("contains a Gate Decision Matrix", () => {
      expect(gateCheckDoc).toContain("Gate Decision Matrix");
    });

    it("lists all 10 required categories as section headings", () => {
      for (const category of REQUIRED_CATEGORIES) {
        expect(gateCheckDoc).toContain(category);
      }
    });

    it("marks categories with REQUIRED and OPTIONAL items", () => {
      expect(gateCheckDoc).toContain("REQUIRED");
      expect(gateCheckDoc).toContain("OPTIONAL");
    });

    it("includes a Final Gate Decision section with PASS/CONDITIONAL/FAIL options", () => {
      expect(gateCheckDoc).toContain("Final Gate Decision");
      expect(gateCheckDoc).toContain("PASS");
      expect(gateCheckDoc).toContain("CONDITIONAL PASS");
      expect(gateCheckDoc).toContain("FAIL");
    });

    it("includes a sign-off section", () => {
      expect(gateCheckDoc).toContain("Sign-off");
    });

    it("references the automation script", () => {
      expect(gateCheckDoc).toContain("gate-check.sh");
    });
  });

  // -----------------------------------------------------------------------
  // gate-check.sh script checks
  // -----------------------------------------------------------------------

  describe("gate-check.sh automation", () => {
    it("uses set -e to exit on error", () => {
      expect(gateCheckScript).toContain("set -e");
    });

    it("tracks failures with a FAILURES counter", () => {
      expect(gateCheckScript).toContain("FAILURES");
      expect(gateCheckScript).toContain("FAILURES=$((FAILURES + 1))");
    });

    it("defines a run_check helper function", () => {
      expect(gateCheckScript).toContain("run_check()");
    });

    it("runs all required npm script checks", () => {
      for (const { name, script } of REQUIRED_SCRIPT_CHECKS) {
        expect(gateCheckScript).toContain(name);
        expect(gateCheckScript).toContain(script);
      }
    });

    it("runs npm audit for security vulnerabilities", () => {
      expect(gateCheckScript).toContain("npm audit");
    });

    it("checks for TODO/FIXME comments", () => {
      expect(gateCheckScript).toContain("TODO");
      expect(gateCheckScript).toContain("FIXME");
    });

    it("checks for console.log/debug statements in production code", () => {
      expect(gateCheckScript).toContain("console");
    });

    it("checks for hardcoded secrets", () => {
      expect(gateCheckScript).toContain("password");
      expect(gateCheckScript).toContain("secret");
    });

    it("checks for README.md existence", () => {
      expect(gateCheckScript).toContain("README.md");
    });

    it("checks for CHANGELOG.md existence", () => {
      expect(gateCheckScript).toContain("CHANGELOG.md");
    });

    it("exits 0 when all checks pass", () => {
      expect(gateCheckScript).toContain("exit 0");
    });

    it("exits 1 when checks fail", () => {
      expect(gateCheckScript).toContain("exit 1");
    });

    it("prints a summary of pass/fail counts", () => {
      expect(gateCheckScript).toContain("Gate Check Summary");
    });
  });

  // -----------------------------------------------------------------------
  // Consistency between document and script
  // -----------------------------------------------------------------------

  describe("document-script consistency", () => {
    it("every category in the Decision Matrix appears in the script or document body", () => {
      // The script implements checks for Code Quality, Testing, Build,
      // Dependencies, Documentation, and Security. The remaining categories
      // (UX, Tech Debt, Performance, Observability, Deployment) are manual
      // checklist items in the protocol document.
      const scriptCategories = [
        "Code Quality",
        "Testing",
        "Build",
        "Dependencies",
        "Documentation",
        "Security",
      ];
      for (const cat of scriptCategories) {
        // The script uses numbered section headers like "1. Code Quality".
        expect(gateCheckScript).toContain(cat);
      }
    });

    it("the script references GATE_CHECK_PROTOCOL.md in its failure output", () => {
      expect(gateCheckScript).toContain("GATE_CHECK_PROTOCOL.md");
    });
  });

  // -----------------------------------------------------------------------
  // package.json gate-check script (optional but documented)
  // -----------------------------------------------------------------------

  describe("package.json integration", () => {
    it("package.json defines all scripts that gate-check.sh invokes", () => {
      const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8")) as {
        scripts: Record<string, string>;
      };

      const requiredScripts = ["typecheck", "lint", "format:check", "test", "build"];
      for (const script of requiredScripts) {
        expect(packageJson.scripts[script]).toBeDefined();
      }
    });
  });
});
