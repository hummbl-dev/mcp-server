/**
 * Golden tests for public vs internal tool registration separation.
 *
 * Invariants enforced:
 * 1. Public agent exposes exactly 8 read-only tools — no write tools.
 * 2. Write tools are hard-rejected (not registered) on the public agent.
 * 3. Internal read-only profile preserves all 12 tools.
 * 4. Internal full profile preserves all tools including workflows.
 *
 * These tests are the hard gate for issue #348.
 * Do NOT deploy mcp-public.hummbl.io until these pass in CI.
 */

import { describe, it, expect } from "vitest";
import { createMockServer } from "./setup.js";
import { registerPublicModelTools, registerModelTools } from "../tools/models.js";
import { registerPublicMethodologyTools, registerMethodologyTools } from "../tools/methodology.js";
import { registerExportTools } from "../tools/export.js";
import { registerWorkflowTools } from "../tools/workflows.js";

/**
 * The 8 tools that MUST be registered on the public agent.
 */
const PUBLIC_TOOLS = [
  "get_model",
  "list_all_models",
  "search_models",
  "get_transformation",
  "search_problem_patterns",
  "recommend_models",
  "get_related_models",
  "get_methodology",
] as const;

/**
 * Tools that MUST NOT be registered on the public agent.
 * These are write/export/internal-graph/user-data tools.
 */
const EXCLUDED_FROM_PUBLIC = [
  "add_relationship",
  "audit_model_references",
  "export_models",
  "get_recommendation_history",
  "list_workflows",
  "start_workflow",
  "continue_workflow",
  "find_workflow_for_problem",
] as const;

describe("Public MCP tool registration — golden inventory", () => {
  it("public agent registers exactly 8 tools", () => {
    const mock: any = createMockServer();
    registerPublicModelTools(mock);
    registerPublicMethodologyTools(mock);

    expect(mock.tools.size).toBe(8);
  });

  it("public agent registers all 8 expected tools", () => {
    const mock: any = createMockServer();
    registerPublicModelTools(mock);
    registerPublicMethodologyTools(mock);

    for (const name of PUBLIC_TOOLS) {
      const tool = mock.getTool(name);
      expect(tool, `Public tool ${name} must be registered`).toBeDefined();
    }
  });

  it("public agent does NOT register any write/internal tools", () => {
    const mock: any = createMockServer();
    registerPublicModelTools(mock);
    registerPublicMethodologyTools(mock);

    for (const name of EXCLUDED_FROM_PUBLIC) {
      const tool = mock.getTool(name);
      expect(tool, `Excluded tool ${name} must NOT be registered on public agent`).toBeUndefined();
    }
  });

  it("add_relationship is NOT registered on public agent", () => {
    const mock: any = createMockServer();
    registerPublicModelTools(mock);
    registerPublicMethodologyTools(mock);

    expect(mock.getTool("add_relationship")).toBeUndefined();
  });

  it("export_models is NOT registered on public agent", () => {
    const mock: any = createMockServer();
    registerPublicModelTools(mock);
    registerPublicMethodologyTools(mock);

    expect(mock.getTool("export_models")).toBeUndefined();
  });

  it("audit_model_references is NOT registered on public agent", () => {
    const mock: any = createMockServer();
    registerPublicModelTools(mock);
    registerPublicMethodologyTools(mock);

    expect(mock.getTool("audit_model_references")).toBeUndefined();
  });
});

describe("Internal read-only profile — preservation test", () => {
  it("internal read-only profile registers all expected tools", () => {
    const mock: any = createMockServer();
    registerModelTools(mock);
    registerMethodologyTools(mock);
    registerExportTools(mock);

    // Read-only profile includes public tools + internal tools
    const expectedTools = [
      ...PUBLIC_TOOLS,
      "add_relationship",
      "audit_model_references",
      "export_models",
      "get_recommendation_history",
    ];

    for (const name of expectedTools) {
      const tool = mock.getTool(name);
      expect(tool, `Internal tool ${name} must be registered`).toBeDefined();
    }
  });

  it("internal read-only profile does NOT register workflow tools", () => {
    const mock: any = createMockServer();
    registerModelTools(mock);
    registerMethodologyTools(mock);
    registerExportTools(mock);
    // registerWorkflowTools intentionally NOT called

    const workflowTools = [
      "list_workflows",
      "start_workflow",
      "continue_workflow",
      "find_workflow_for_problem",
    ];
    for (const name of workflowTools) {
      expect(
        mock.getTool(name),
        `Workflow tool ${name} must NOT be in read-only profile`
      ).toBeUndefined();
    }
  });
});

describe("Internal full profile — preservation test", () => {
  it("full profile registers all tools including workflows", () => {
    const mock: any = createMockServer();
    registerModelTools(mock);
    registerMethodologyTools(mock);
    registerExportTools(mock);
    registerWorkflowTools(mock);

    const allTools = [
      ...PUBLIC_TOOLS,
      "add_relationship",
      "audit_model_references",
      "export_models",
      "get_recommendation_history",
      "list_workflows",
      "start_workflow",
      "continue_workflow",
      "find_workflow_for_problem",
    ];

    for (const name of allTools) {
      const tool = mock.getTool(name);
      expect(tool, `Full profile tool ${name} must be registered`).toBeDefined();
    }
  });
});

describe("Tool registration separation invariant", () => {
  it("registerPublicModelTools is a subset of registerModelTools", () => {
    const publicMock: any = createMockServer();
    registerPublicModelTools(publicMock);

    const internalMock: any = createMockServer();
    registerModelTools(internalMock);

    // Every tool in public must also be in internal
    for (const [name] of publicMock.tools) {
      expect(
        internalMock.getTool(name),
        `Public tool ${name} must also exist in internal`
      ).toBeDefined();
    }
  });

  it("registerPublicMethodologyTools is a subset of registerMethodologyTools", () => {
    const publicMock: any = createMockServer();
    registerPublicMethodologyTools(publicMock);

    const internalMock: any = createMockServer();
    registerMethodologyTools(internalMock);

    for (const [name] of publicMock.tools) {
      expect(
        internalMock.getTool(name),
        `Public methodology tool ${name} must also exist in internal`
      ).toBeDefined();
    }
  });

  it("public agent has strictly fewer tools than internal read-only", () => {
    const publicMock: any = createMockServer();
    registerPublicModelTools(publicMock);
    registerPublicMethodologyTools(publicMock);

    const internalMock: any = createMockServer();
    registerModelTools(internalMock);
    registerMethodologyTools(internalMock);
    registerExportTools(internalMock);

    expect(publicMock.tools.size).toBeLessThan(internalMock.tools.size);
  });

  it("no write tools overlap between public and internal read-only profiles", () => {
    // The set of tools in the public agent must be a strict subset
    // of the read-only tools in the internal agent.
    // No write tool may appear in both.
    const WRITE_TOOLS = [
      "add_relationship",
      "audit_model_references",
      "export_models",
      "start_workflow",
      "continue_workflow",
    ] as const;

    const publicMock: any = createMockServer();
    registerPublicModelTools(publicMock);
    registerPublicMethodologyTools(publicMock);

    for (const name of WRITE_TOOLS) {
      expect(
        publicMock.getTool(name),
        `Write tool ${name} must NOT be in public agent`
      ).toBeUndefined();
    }
  });
});
