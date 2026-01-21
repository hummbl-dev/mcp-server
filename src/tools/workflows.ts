/**
 * HUMMBL Workflow Tools
 * Guided multi-turn problem-solving workflows
 * Phase 2 Implementation
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  getWorkflowTemplate,
  listWorkflows,
  findWorkflowsByProblem,
} from "../framework/workflows.js";
import type { WorkflowState, WorkflowType } from "../types/domain.js";

/**
 * Register workflow-related tools with the MCP server
 */
export function registerWorkflowTools(server: McpServer): void {
  // Tool: List available workflows
  server.registerTool(
    "list_workflows",
    {
      title: "List Available Workflows",
      description: "Get all available guided workflows for problem-solving with mental models.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        count: z.number(),
        workflows: z.array(
          z.object({
            name: z.string(),
            displayName: z.string(),
            description: z.string(),
            problemTypes: z.array(z.string()),
            stepCount: z.number(),
            estimatedDuration: z.string(),
          })
        ),
      }),
    },
    async () => {
      const workflows = listWorkflows();

      const payload = {
        count: workflows.length,
        workflows: workflows.map((wf) => ({
          name: wf.name,
          displayName: wf.displayName,
          description: wf.description,
          problemTypes: wf.problemTypes,
          stepCount: wf.steps.length,
          estimatedDuration: wf.estimatedDuration,
        })),
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
        structuredContent: payload,
      } as const;
    }
  );

  // Tool: Start a workflow
  server.registerTool(
    "start_workflow",
    {
      title: "Start Guided Workflow",
      description:
        "Begin a guided multi-turn workflow for systematic problem-solving using mental models.",
      inputSchema: z.object({
        workflow_name: z
          .enum(["root_cause_analysis", "strategy_design", "decision_making"])
          .describe("Which workflow to start"),
        problem_description: z
          .string()
          .min(10)
          .describe("Brief description of your problem or goal"),
        session_id: z
          .string()
          .uuid()
          .optional()
          .describe("Optional session ID for state persistence"),
      }),
      outputSchema: z.object({
        workflow: z.string(),
        displayName: z.string(),
        problemDescription: z.string(),
        currentStep: z.number(),
        totalSteps: z.number(),
        transformation: z.string(),
        guidance: z.string(),
        suggestedModels: z.array(z.string()),
        questions: z.array(z.string()),
        nextAction: z.string(),
      }),
    },
    async ({ workflow_name, problem_description, session_id }) => {
      const template = getWorkflowTemplate(workflow_name);

      if (!template) {
        return {
          content: [
            {
              type: "text",
              text: `Workflow '${workflow_name}' not found. Valid workflows: root_cause_analysis, strategy_design, decision_making`,
            },
          ],
          isError: true,
        } as const;
      }

      // Initialize workflow state
      const workflowState: WorkflowState = {
        workflowName: workflow_name as WorkflowType,
        currentStep: 1,
        totalSteps: template.steps.length,
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        completed: false,
        stepResults: {},
      };

      // Get first step
      const firstStep = template.steps[0];

      const payload = {
        workflow: template.name,
        displayName: template.displayName,
        problemDescription: problem_description,
        currentStep: 1,
        totalSteps: template.steps.length,
        transformation: firstStep.transformation,
        guidance: firstStep.guidance,
        suggestedModels: firstStep.models,
        questions: firstStep.questions,
        nextAction: `Apply these ${firstStep.models.length} models from the ${firstStep.transformation} transformation and share your insights. Use 'continue_workflow' when ready to proceed.`,
        sessionId: session_id || "stateless",
        workflowState,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
        structuredContent: payload,
      } as const;
    }
  );

  // Tool: Continue workflow to next step
  server.registerTool(
    "continue_workflow",
    {
      title: "Continue Workflow",
      description:
        "Proceed to the next step of your guided workflow after completing the current step.",
      inputSchema: z.object({
        workflow_name: z
          .enum(["root_cause_analysis", "strategy_design", "decision_making"])
          .describe("Which workflow you're working on"),
        current_step: z.number().int().min(1).describe("Current step number"),
        step_insights: z
          .string()
          .min(10)
          .describe("Your insights or outputs from completing the current step"),
        session_id: z.string().uuid().optional().describe("Session ID if using state persistence"),
      }),
      outputSchema: z.object({
        workflow: z.string(),
        displayName: z.string(),
        currentStep: z.number(),
        totalSteps: z.number(),
        transformation: z.string(),
        guidance: z.string(),
        suggestedModels: z.array(z.string()),
        questions: z.array(z.string()),
        nextAction: z.string(),
        completed: z.boolean(),
      }),
    },
    async ({ workflow_name, current_step, step_insights, session_id }) => {
      const template = getWorkflowTemplate(workflow_name);

      if (!template) {
        return {
          content: [
            {
              type: "text",
              text: `Workflow '${workflow_name}' not found.`,
            },
          ],
          isError: true,
        } as const;
      }

      // Calculate next step
      const nextStepNumber = current_step + 1;
      const isCompleted = nextStepNumber > template.steps.length;

      if (isCompleted) {
        // Workflow completed
        const payload = {
          workflow: template.name,
          displayName: template.displayName,
          currentStep: template.steps.length,
          totalSteps: template.steps.length,
          transformation: "COMPLETE",
          guidance:
            "Workflow completed! Review your insights from all steps to synthesize your solution.",
          suggestedModels: [],
          questions: [
            "What are the key insights across all steps?",
            "What's your final conclusion or recommendation?",
            "What actions will you take based on this analysis?",
          ],
          nextAction: "Synthesize insights and determine next actions. Workflow complete.",
          completed: true,
          sessionId: session_id || "stateless",
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(payload, null, 2),
            },
          ],
          structuredContent: payload,
        } as const;
      }

      // Get next step
      const nextStep = template.steps[nextStepNumber - 1];

      const payload = {
        workflow: template.name,
        displayName: template.displayName,
        previousStepInsights: step_insights,
        currentStep: nextStepNumber,
        totalSteps: template.steps.length,
        transformation: nextStep.transformation,
        guidance: nextStep.guidance,
        suggestedModels: nextStep.models,
        questions: nextStep.questions,
        nextAction: `Apply these ${nextStep.models.length} models from the ${nextStep.transformation} transformation. When ready, use 'continue_workflow' to proceed.`,
        completed: false,
        sessionId: session_id || "stateless",
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
        structuredContent: payload,
      } as const;
    }
  );

  // Tool: Find workflows by problem type
  server.registerTool(
    "find_workflow_for_problem",
    {
      title: "Find Workflow for Problem",
      description: "Discover which workflow best fits your problem type or situation.",
      inputSchema: z.object({
        problem_keywords: z
          .string()
          .min(3)
          .describe("Keywords describing your problem (e.g., 'failure', 'strategy', 'decision')"),
      }),
      outputSchema: z.object({
        query: z.string(),
        matchCount: z.number(),
        recommendations: z.array(
          z.object({
            workflow: z.string(),
            displayName: z.string(),
            description: z.string(),
            matchedProblemTypes: z.array(z.string()),
            estimatedDuration: z.string(),
          })
        ),
      }),
    },
    async ({ problem_keywords }) => {
      const matches = findWorkflowsByProblem(problem_keywords);

      const recommendations = matches.map((wf) => {
        const matchedTypes = wf.problemTypes.filter((pt) =>
          pt.toLowerCase().includes(problem_keywords.toLowerCase())
        );

        return {
          workflow: wf.name,
          displayName: wf.displayName,
          description: wf.description,
          matchedProblemTypes: matchedTypes.length > 0 ? matchedTypes : wf.problemTypes.slice(0, 2),
          estimatedDuration: wf.estimatedDuration,
        };
      });

      const payload = {
        query: problem_keywords,
        matchCount: recommendations.length,
        recommendations,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
        structuredContent: payload,
      } as const;
    }
  );
}
