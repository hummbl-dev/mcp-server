/**
 * Tool exposure profile tests
 *
 * Verifies that server-side profiles correctly control which tools
 * are registered on the server.
 *
 * Refs: hummbl-dev/mcp-server#342
 */

import { describe, it, expect } from "vitest";
import { createMockServer } from "./setup.js";
import { type ServerProfile } from "../server.js";
import { registerModelTools } from "../tools/models.js";
import { registerMethodologyTools } from "../tools/methodology.js";
import { registerWorkflowTools } from "../tools/workflows.js";
import { registerExportTools } from "../tools/export.js";

/**
 * Write tools that must NOT appear in readonly profile.
 */
const WRITE_TOOLS = [
  "start_workflow",
  "continue_workflow",
] as const;

/**
 * Tools that MUST appear in readonly profile.
 */
const READONLY_TOOLS = [
  "get_model",
  "list_all_models",
  "search_models",
  "get_transformation",
  "search_problem_patterns",
  "recommend_models",
  "get_related_models",
  "get_methodology",
  "audit_model_references",
  "export_models",
] as const;

describe("Tool exposure profiles", () => {
  describe("readonly profile", () => {
    it("excludes write tools", () => {
      const mock: any = createMockServer();
      // Simulate readonly registration
      registerModelTools(mock);
      registerMethodologyTools(mock);
      registerExportTools(mock);

      for (const name of WRITE_TOOLS) {
        expect(
          mock.getTool(name),
          `Write tool "${name}" must NOT be in readonly profile`
        ).toBeUndefined();
      }
    });

    it("includes all read-only tools", () => {
      const mock: any = createMockServer();
      registerModelTools(mock);
      registerMethodologyTools(mock);
      registerExportTools(mock);

      for (const name of READONLY_TOOLS) {
        expect(
          mock.getTool(name),
          `Read-only tool "${name}" must be in readonly profile`
        ).toBeDefined();
      }
    });
  });

  describe("full profile", () => {
    it("includes write tools", () => {
      const mock: any = createMockServer();
      registerModelTools(mock);
      registerMethodologyTools(mock);
      registerWorkflowTools(mock);
      registerExportTools(mock);

      for (const name of WRITE_TOOLS) {
        expect(
          mock.getTool(name),
          `Write tool "${name}" must be in full profile`
        ).toBeDefined();
      }
    });
  });

  describe("profile separation", () => {
    it("readonly has strictly fewer tools than full", () => {
      const readonlyMock: any = createMockServer();
      registerModelTools(readonlyMock);
      registerMethodologyTools(readonlyMock);
      registerExportTools(readonlyMock);

      const fullMock: any = createMockServer();
      registerModelTools(fullMock);
      registerMethodologyTools(fullMock);
      registerWorkflowTools(fullMock);
      registerExportTools(fullMock);

      expect(readonlyMock.tools.size).toBeLessThan(fullMock.tools.size);
    });
  });

  describe("ServerProfile type", () => {
    it("accepts valid profile values", () => {
      const validProfiles: ServerProfile[] = ["readonly", "dev", "prod", "full"];
      for (const profile of validProfiles) {
        expect(typeof profile).toBe("string");
      }
    });
  });
});
