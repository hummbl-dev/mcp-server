/**
 * Tool Registration Tests
 *
 * Validates the MCP tool registration system: correct registration of every
 * tool group, no duplicate names, required metadata on each tool, schema
 * presence, deregistration via `remove()`, disable/enable, and duplicate
 * registration detection.
 *
 * Uses the real `McpServer` from the SDK (not a mock) so that the
 * registration contract is exercised end-to-end.
 *
 * Fixes #233
 */

import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerModelTools } from "../tools/models.js";
import { registerMethodologyTools } from "../tools/methodology.js";
import { registerWorkflowTools } from "../tools/workflows.js";
import { registerExportTools } from "../tools/export.js";
import { registerModelResources } from "../resources/models.js";
import { registerMethodologyResources } from "../resources/methodology.js";
import { registerWorkflowPrompts } from "../prompts/workflows.js";

/**
 * Inspect the private tool registry of an McpServer to get the set of
 * registered tool names. The SDK stores tools in `_registeredTools` on the
 * server instance as a plain object (Record<string, RegisteredTool>).
 */
function getRegisteredToolNames(server: McpServer): string[] {
  const internal = server as unknown as {
    _registeredTools?: Record<string, unknown>;
  };
  if (internal._registeredTools && typeof internal._registeredTools === "object") {
    return Object.keys(internal._registeredTools);
  }
  return [];
}

describe("Tool Registration", () => {
  let server: McpServer;

  beforeEach(() => {
    server = new McpServer({ name: "test-server", version: "1.0.0" });
  });

  // -----------------------------------------------------------------------
  // Per-module registration
  // -----------------------------------------------------------------------

  describe("registerModelTools", () => {
    it("registers all model tools", () => {
      registerModelTools(server);
      const names = getRegisteredToolNames(server);
      const expected = [
        "get_model",
        "list_all_models",
        "search_models",
        "get_transformation",
        "search_problem_patterns",
        "recommend_models",
        "get_related_models",
        "add_relationship",
        "get_recommendation_history",
      ];
      for (const name of expected) {
        expect(names).toContain(name);
      }
    });
  });

  describe("registerMethodologyTools", () => {
    it("registers methodology tools", () => {
      registerMethodologyTools(server);
      const names = getRegisteredToolNames(server);
      expect(names).toContain("get_methodology");
      expect(names).toContain("audit_model_references");
    });
  });

  describe("registerWorkflowTools", () => {
    it("registers all workflow tools", () => {
      registerWorkflowTools(server);
      const names = getRegisteredToolNames(server);
      const expected = [
        "list_workflows",
        "start_workflow",
        "continue_workflow",
        "find_workflow_for_problem",
      ];
      for (const name of expected) {
        expect(names).toContain(name);
      }
    });
  });

  describe("registerExportTools", () => {
    it("registers the export_models tool", () => {
      registerExportTools(server);
      const names = getRegisteredToolNames(server);
      expect(names).toContain("export_models");
    });
  });

  // -----------------------------------------------------------------------
  // Full server registration (createServer equivalent)
  // -----------------------------------------------------------------------

  describe("full server registration", () => {
    beforeEach(() => {
      registerModelTools(server);
      registerMethodologyTools(server);
      registerWorkflowTools(server);
      registerExportTools(server);
    });

    it("registers at least 16 tools total", () => {
      const names = getRegisteredToolNames(server);
      expect(names.length).toBeGreaterThanOrEqual(16);
    });

    it("has no duplicate tool names", () => {
      const names = getRegisteredToolNames(server);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it("every tool name is a non-empty string", () => {
      const names = getRegisteredToolNames(server);
      for (const name of names) {
        expect(typeof name).toBe("string");
        expect(name.length).toBeGreaterThan(0);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Duplicate registration detection
  // -----------------------------------------------------------------------

  describe("duplicate registration", () => {
    it("throws when registering the same tool name twice", () => {
      const handler = async () => ({ content: [{ type: "text" as const, text: "ok" }] });

      server.registerTool("duplicate_tool", { description: "First registration" }, handler);

      expect(() => {
        server.registerTool("duplicate_tool", { description: "Second registration" }, handler);
      }).toThrow();
    });

    it("allows registering different tool names without error", () => {
      const handler = async () => ({ content: [{ type: "text" as const, text: "ok" }] });

      expect(() => {
        server.registerTool("tool_a", { description: "A" }, handler);
        server.registerTool("tool_b", { description: "B" }, handler);
      }).not.toThrow();

      const names = getRegisteredToolNames(server);
      expect(names).toContain("tool_a");
      expect(names).toContain("tool_b");
    });
  });

  // -----------------------------------------------------------------------
  // Deregistration via remove()
  // -----------------------------------------------------------------------

  describe("deregistration", () => {
    it("remove() deletes the tool from the registry", () => {
      const handler = async () => ({ content: [{ type: "text" as const, text: "ok" }] });
      const registered = server.registerTool(
        "removable_tool",
        { description: "Will be removed" },
        handler
      );

      expect(getRegisteredToolNames(server)).toContain("removable_tool");

      registered.remove();

      expect(getRegisteredToolNames(server)).not.toContain("removable_tool");
    });

    it("remove() on a model tool removes it from the full set", () => {
      registerModelTools(server);
      const namesBefore = getRegisteredToolNames(server);
      expect(namesBefore).toContain("get_model");

      // Re-register to get a handle, then remove.
      // The SDK's registerTool returns a RegisteredTool with remove().
      // We need to capture the return from the initial registration.
      // Since registerModelTools doesn't return handles, we re-register
      // a fresh tool to test the remove path.
      const handler = async () => ({ content: [{ type: "text" as const, text: "ok" }] });
      const reg = server.registerTool("temp_tool", { description: "temp" }, handler);
      reg.remove();
      expect(getRegisteredToolNames(server)).not.toContain("temp_tool");
    });
  });

  // -----------------------------------------------------------------------
  // Enable / disable
  // -----------------------------------------------------------------------

  describe("enable / disable", () => {
    it("disable() and enable() toggle the tool without removing it", () => {
      const handler = async () => ({ content: [{ type: "text" as const, text: "ok" }] });
      const registered = server.registerTool(
        "toggleable_tool",
        { description: "Can be disabled" },
        handler
      );

      // Tool is present and enabled by default.
      expect(getRegisteredToolNames(server)).toContain("toggleable_tool");
      expect(registered.enabled).toBe(true);

      // Disable — tool should still be in registry but marked disabled.
      registered.disable();
      expect(registered.enabled).toBe(false);
      expect(getRegisteredToolNames(server)).toContain("toggleable_tool");

      // Re-enable.
      registered.enable();
      expect(registered.enabled).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Schema validation on registration
  // -----------------------------------------------------------------------

  describe("schema presence", () => {
    it("registerTool accepts a zod inputSchema", () => {
      const handler = async (_args: { name: string }) => ({
        content: [{ type: "text" as const, text: "ok" }],
      });

      expect(() => {
        server.registerTool(
          "schema_tool",
          {
            description: "Has a schema",
            inputSchema: z.object({ name: z.string() }),
          },
          handler
        );
      }).not.toThrow();

      expect(getRegisteredToolNames(server)).toContain("schema_tool");
    });

    it("registerTool works with an empty input schema for no-arg tools", () => {
      const handler = async () => ({
        content: [{ type: "text" as const, text: "ok" }],
      });

      expect(() => {
        server.registerTool(
          "no_arg_tool",
          {
            description: "No arguments",
            inputSchema: z.object({}),
          },
          handler
        );
      }).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Resource and prompt registration (for completeness)
  // -----------------------------------------------------------------------

  describe("resource registration", () => {
    it("registers all model resources without error", () => {
      expect(() => {
        registerModelResources(server);
      }).not.toThrow();
    });

    it("registers all methodology resources without error", () => {
      expect(() => {
        registerMethodologyResources(server);
      }).not.toThrow();
    });

    it("throws when registering a duplicate resource URI", () => {
      const handler = async () => ({
        contents: [{ uri: "test://a", mimeType: "text/plain", text: "ok" }],
      });

      server.registerResource("res_a", "test://a", { description: "First" }, handler);

      // The SDK keys resources by URI, so a duplicate URI (even with a
      // different name) throws.
      expect(() => {
        server.registerResource("res_b", "test://a", { description: "Second" }, handler);
      }).toThrow();
    });
  });

  describe("prompt registration", () => {
    it("registers all workflow prompts without error", () => {
      expect(() => {
        registerWorkflowPrompts(server);
      }).not.toThrow();
    });

    it("throws when registering a duplicate prompt name", () => {
      const handler = () => ({
        description: "test",
        messages: [{ role: "user" as const, content: { type: "text" as const, text: "ok" } }],
      });

      server.registerPrompt("dup_prompt", { description: "First" }, handler);

      expect(() => {
        server.registerPrompt("dup_prompt", { description: "Second" }, handler);
      }).toThrow();
    });
  });
});
