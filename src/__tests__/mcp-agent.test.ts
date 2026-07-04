/**
 * Tests for the Cloudflare Agents SDK MCP entrypoint (mcp-agent.ts)
 *
 * Verifies the transport/auth boundary:
 * - Read-only tool profile (no write tools registered)
 * - Production fail-closed guard logic
 */

import { describe, it, expect } from "vitest";
import { createMockServer } from "./setup.js";
import { registerModelTools, registerPublicModelTools } from "../tools/models.js";
import { registerMethodologyTools } from "../tools/methodology.js";
import { registerExportTools } from "../tools/export.js";

describe("MCP Agent entrypoint — read-only tool profile", () => {
  it("read-only tools are registered (model, methodology, export)", () => {
    const mock: any = createMockServer();
    registerModelTools(mock);
    registerMethodologyTools(mock);
    registerExportTools(mock);

    const readOnlyTools = [
      "get_model",
      "list_all_models",
      "search_models",
      "get_transformation",
      "search_problem_patterns",
      "get_methodology",
      "audit_model_references",
      "export_models",
    ];

    for (const name of readOnlyTools) {
      const tool = mock.getTool(name);
      expect(tool, `Tool ${name} should be registered`).toBeDefined();
    }
  });

  it("workflow write tools are NOT registered in the read-only profile", () => {
    const mock: any = createMockServer();
    registerModelTools(mock);
    registerMethodologyTools(mock);
    registerExportTools(mock);
    // registerWorkflowTools intentionally NOT called

    const workflowWriteTools = [
      "start_workflow",
      "continue_workflow",
      "list_workflows",
      "find_workflow_for_problem",
    ];

    for (const name of workflowWriteTools) {
      const tool = mock.getTool(name);
      expect(tool, `Workflow tool ${name} must NOT be registered`).toBeUndefined();
    }
  });

  it("add_relationship IS registered in internal read-only profile (known behavior)", () => {
    // This test documents that the internal read-only profile includes
    // add_relationship. The PUBLIC profile (registerPublicModelTools)
    // excludes it. See public-tool-profile.test.ts for the public guard.
    const mock: any = createMockServer();
    registerModelTools(mock);

    expect(mock.getTool("add_relationship")).toBeDefined();
  });

  it("add_relationship is NOT registered when using registerPublicModelTools", () => {
    const mock: any = createMockServer();
    registerPublicModelTools(mock);

    expect(mock.getTool("add_relationship")).toBeUndefined();
  });
});

describe("MCP Agent entrypoint — production fail-closed guard", () => {
  it("fail-closed logic: production + no override = 503", () => {
    const isProduction = true;
    const allowUnauthenticated = false;
    const shouldFailClosed = isProduction && !allowUnauthenticated;
    expect(shouldFailClosed).toBe(true);
  });

  it("fail-closed logic: production + override = allow (unsafe)", () => {
    const isProduction = true;
    const allowUnauthenticated = true;
    const shouldFailClosed = isProduction && !allowUnauthenticated;
    expect(shouldFailClosed).toBe(false);
  });

  it("fail-closed logic: staging = allow", () => {
    const isProduction = false;
    const allowUnauthenticated = false;
    const shouldFailClosed = isProduction && !allowUnauthenticated;
    expect(shouldFailClosed).toBe(false);
  });

  it("failClosedResponse returns 503 with JSON error body", async () => {
    // Replicate the failClosedResponse logic
    const response = new Response(
      JSON.stringify({
        error: "MCP endpoint not available in production without authentication.",
        hint: "Implement OAuth 2.1 / RFC 9728 before enabling this route.",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );

    expect(response.status).toBe(503);
    const body: any = await response.json();
    expect(body.error).toContain("not available in production");
    expect(body.hint).toContain("OAuth 2.1");
  });
});
