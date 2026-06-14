/**
 * Minimal smoke tests for the HTTP MCP entrypoint (ChatGPT connector v0)
 */

import { describe, it, expect } from "vitest";
import { createServer } from "../server.js";
import { createMockServer } from "./setup.js";
import { registerModelTools } from "../tools/models.js";
import { registerMethodologyTools } from "../tools/methodology.js";
import { registerWorkflowTools } from "../tools/workflows.js";
import { registerExportTools } from "../tools/export.js";

describe("MCP HTTP entrypoint", () => {
  it("createServer() returns a defined MCP server", () => {
    const server = createServer();
    expect(server).toBeDefined();
  });

  it("read-only tools include annotations on mock server", () => {
    const mock: any = createMockServer();
    registerModelTools(mock);
    registerMethodologyTools(mock);
    registerWorkflowTools(mock);
    registerExportTools(mock);

    const readOnlyTools = [
      "get_model",
      "list_all_models",
      "search_models",
      "get_transformation",
      "search_problem_patterns",
      "get_methodology",
      "audit_model_references",
      "list_workflows",
      "find_workflow_for_problem",
    ];

    for (const name of readOnlyTools) {
      const tool = mock.getTool(name);
      expect(tool, `Tool ${name} should be registered`).toBeDefined();
      expect(tool?.schema?.annotations?.readOnlyHint, `Tool ${name} should have readOnlyHint`).toBe(
        true
      );
    }
  });

  it("write tools do not have readOnlyHint on mock server", () => {
    const mock: any = createMockServer();
    registerModelTools(mock);
    registerMethodologyTools(mock);
    registerWorkflowTools(mock);
    registerExportTools(mock);

    const writeTools = ["start_workflow", "continue_workflow", "export_models"];

    for (const name of writeTools) {
      const tool = mock.getTool(name);
      expect(tool, `Tool ${name} should be registered`).toBeDefined();
      const hint = tool?.schema?.annotations?.readOnlyHint;
      expect(hint, `Tool ${name} should NOT have readOnlyHint`).not.toBe(true);
    }
  });
});
