/**
 * HUMMBL MCP Prompts
 *
 * MCP prompts are user-invocable templates surfaced by MCP clients (e.g. as
 * slash-commands in Claude Desktop). Unlike tools, which the model calls
 * autonomously, prompts are chosen by the human to kick off a conversation
 * shape. Each HUMMBL prompt here takes a problem description and returns a
 * seeded user message that walks the model into the first step of a
 * Base120 workflow or analysis, then hands off to the existing tools.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { WORKFLOW_TEMPLATES, getWorkflowTemplate } from "../framework/workflows.js";
import type { WorkflowTemplate, WorkflowStep } from "../types/domain.js";
import { TRANSFORMATIONS } from "../framework/base120.js";

type TextMessage = {
  role: "user";
  content: { type: "text"; text: string };
};

function textMessage(text: string): TextMessage {
  return { role: "user", content: { type: "text", text } };
}

/**
 * Render a workflow's first step as a kickoff message for the model.
 * Subsequent steps are reached via the existing `continue_workflow` tool.
 */
function renderWorkflowKickoff(template: WorkflowTemplate, problem: string): string {
  const firstStep: WorkflowStep = template.steps[0]!;
  const transformation = TRANSFORMATIONS[firstStep.transformation];
  const transformationLabel = transformation ? transformation.name : firstStep.transformation;
  const questions = firstStep.questions.map((q) => `- ${q}`).join("\n");
  const models = firstStep.models.join(", ");

  return [
    `I need to work through this using the HUMMBL **${template.displayName}** workflow.`,
    "",
    `**Problem:**`,
    problem.trim(),
    "",
    `**Approach:** ${template.description}`,
    "",
    `**Step 1 — ${transformationLabel} (${firstStep.transformation})**`,
    firstStep.guidance,
    "",
    `Suggested models for this step: ${models}`,
    "",
    `Questions to explore:`,
    questions,
    "",
    `**Expected output from this step:** ${firstStep.expectedOutput}`,
    "",
    `Please help me work through Step 1. You can call \`get_model\` for details on any suggested model, \`search_models\` to find additional relevant models, and \`continue_workflow\` to advance to the next step when I'm ready.`,
  ].join("\n");
}

/**
 * Kickoff message for the general "analyze with mental models" prompt.
 * Suggests the recommend_models tool as the first action.
 */
function renderAnalyzeKickoff(problem: string): string {
  return [
    `I'd like you to analyze this problem using the HUMMBL Base120 mental-model framework.`,
    "",
    `**Problem:**`,
    problem.trim(),
    "",
    `Please:`,
    `1. Call \`recommend_models\` with this problem to get a ranked list of relevant mental models across the six transformations (Perspective, Inversion, Composition, Decomposition, Recursion, Meta-Systems).`,
    `2. For the top 3–5 recommended models, call \`get_model\` to retrieve their definitions and "when to use" guidance.`,
    `3. Synthesise the models into a concrete analysis of the problem — what each model surfaces, where they agree, where they disagree, and what actions they jointly suggest.`,
  ].join("\n");
}

/**
 * Kickoff message for applying one specific model to a problem.
 */
function renderApplyModelKickoff(modelCode: string, problem: string): string {
  const normalized = modelCode.toUpperCase();
  return [
    `I want to apply the HUMMBL mental model **${normalized}** to this problem.`,
    "",
    `**Problem:**`,
    problem.trim(),
    "",
    `Please:`,
    `1. Call \`get_model\` with code \`${normalized}\` to retrieve its definition, example, "when to use", and "how to apply" fields.`,
    `2. Walk me through applying that model to my problem step by step, using its "how to apply" guidance.`,
    `3. Produce a concrete output I can act on.`,
  ].join("\n");
}

/**
 * Register all HUMMBL MCP prompts with the server.
 *
 * Registers one workflow-kickoff prompt per entry in WORKFLOW_TEMPLATES plus
 * two general-purpose prompts (analyse_with_models, apply_model).
 */
export function registerWorkflowPrompts(server: McpServer): void {
  // Workflow-kickoff prompts (one per template).
  for (const template of Object.values(WORKFLOW_TEMPLATES)) {
    server.registerPrompt(
      template.name,
      {
        title: template.displayName,
        description: `${template.description} (~${template.estimatedDuration})`,
        argsSchema: {
          problem: z.string().describe("Describe the problem or situation you want to work on."),
        },
      },
      ({ problem }) => {
        const resolved = getWorkflowTemplate(template.name);
        if (!resolved) {
          return {
            description: `Unknown workflow: ${template.name}`,
            messages: [textMessage(`Workflow "${template.name}" is not registered.`)],
          };
        }
        return {
          description: `Kick off the ${resolved.displayName} workflow.`,
          messages: [textMessage(renderWorkflowKickoff(resolved, problem))],
        };
      }
    );
  }

  // General-purpose: recommend models for any problem.
  server.registerPrompt(
    "analyze_with_models",
    {
      title: "Analyze with HUMMBL Mental Models",
      description:
        "Open-ended analysis: surface the most relevant Base120 mental models for a problem and synthesise them into concrete guidance.",
      argsSchema: {
        problem: z.string().describe("Describe the problem you'd like analysed."),
      },
    },
    ({ problem }) => ({
      description: "Analyze a problem through the Base120 framework.",
      messages: [textMessage(renderAnalyzeKickoff(problem))],
    })
  );

  // Apply one specific model.
  server.registerPrompt(
    "apply_model",
    {
      title: "Apply a HUMMBL Mental Model",
      description:
        "Apply one specific HUMMBL mental model (by code, e.g. P1, IN3, CO5) to a problem.",
      argsSchema: {
        model_code: z
          .string()
          .regex(/^(P|IN|CO|DE|RE|SY)\d{1,2}$/i)
          .describe("Model code (e.g. P1, IN3, CO5)."),
        problem: z.string().describe("Describe the problem or situation."),
      },
    },
    ({ model_code, problem }) => ({
      description: `Apply model ${model_code.toUpperCase()} to the problem.`,
      messages: [textMessage(renderApplyModelKickoff(model_code, problem))],
    })
  );
}
