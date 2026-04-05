import { describe, it, expect, beforeEach } from "vitest";
import { registerWorkflowPrompts } from "../prompts/workflows.js";
import { WORKFLOW_TEMPLATES } from "../framework/workflows.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type RegisteredPrompt = {
  config: {
    title?: string;
    description?: string;
    argsSchema?: Record<string, unknown>;
  };
  handler: (args: Record<string, string>) => {
    description: string;
    messages: Array<{ role: "user"; content: { type: "text"; text: string } }>;
  };
};

function createPromptHarness() {
  const prompts = new Map<string, RegisteredPrompt>();
  const harness = {
    registerPrompt: (
      name: string,
      config: RegisteredPrompt["config"],
      handler: RegisteredPrompt["handler"]
    ) => {
      prompts.set(name, { config, handler });
    },
  };
  return { server: harness as unknown as McpServer, prompts };
}

describe("MCP prompts", () => {
  let prompts: Map<string, RegisteredPrompt>;

  beforeEach(() => {
    const { server, prompts: p } = createPromptHarness();
    prompts = p;
    registerWorkflowPrompts(server);
  });

  it("registers one prompt per workflow template plus two general-purpose prompts", () => {
    const workflowCount = Object.keys(WORKFLOW_TEMPLATES).length;
    expect(prompts.size).toBe(workflowCount + 2);
  });

  it("registers every workflow template by name", () => {
    for (const name of Object.keys(WORKFLOW_TEMPLATES)) {
      expect(prompts.has(name)).toBe(true);
    }
  });

  it("registers analyze_with_models and apply_model", () => {
    expect(prompts.has("analyze_with_models")).toBe(true);
    expect(prompts.has("apply_model")).toBe(true);
  });

  it("workflow prompts carry the template's displayName as the title", () => {
    for (const [name, template] of Object.entries(WORKFLOW_TEMPLATES)) {
      expect(prompts.get(name)!.config.title).toBe(template.displayName);
    }
  });

  it("workflow prompts declare a required problem argument", () => {
    for (const name of Object.keys(WORKFLOW_TEMPLATES)) {
      const schema = prompts.get(name)!.config.argsSchema;
      expect(schema).toBeDefined();
      expect(schema!.problem).toBeDefined();
    }
  });

  it("workflow kickoff message includes the problem, step-1 guidance, and model codes", () => {
    const problem = "Our nightly batch job silently loses 3% of records.";
    const result = prompts.get("root_cause_analysis")!.handler({ problem });

    expect(result.messages).toHaveLength(1);
    const text = result.messages[0]!.content.text;

    // Mentions the workflow by display name
    expect(text).toContain("Root Cause Analysis");
    // Echoes the problem verbatim
    expect(text).toContain(problem);
    // Mentions step 1 and its transformation
    expect(text).toContain("Step 1");
    expect(text).toContain("Perspective");
    // Lists the step-1 models from the template
    const firstStep = WORKFLOW_TEMPLATES.root_cause_analysis!.steps[0]!;
    for (const code of firstStep.models) {
      expect(text).toContain(code);
    }
    // Points the model at the existing tools
    expect(text).toContain("continue_workflow");
    expect(text).toContain("get_model");
  });

  it("analyze_with_models directs the model to recommend_models first", () => {
    const problem = "How should we structure our Q3 roadmap?";
    const result = prompts.get("analyze_with_models")!.handler({ problem });
    const text = result.messages[0]!.content.text;
    expect(text).toContain(problem);
    expect(text).toContain("recommend_models");
    expect(text).toContain("get_model");
  });

  it("apply_model uppercases the model code and only references real get_model fields", () => {
    const result = prompts.get("apply_model")!.handler({
      model_code: "in3",
      problem: "Deciding whether to sunset a product line.",
    });
    const text = result.messages[0]!.content.text;
    expect(text).toContain("IN3");
    // Real fields returned by get_model — must be mentioned.
    expect(text).toContain("definition");
    expect(text).toContain("transformation");
    // Fields that get_model does NOT return — must not be referenced.
    expect(text).not.toContain("how to apply");
    expect(text).not.toContain("when to use");
    expect(text).toContain("Deciding whether to sunset a product line.");
  });

  it("result description summarises which prompt was invoked", () => {
    const { description } = prompts.get("root_cause_analysis")!.handler({
      problem: "anything",
    });
    expect(description).toContain("Root Cause Analysis");
  });
});
