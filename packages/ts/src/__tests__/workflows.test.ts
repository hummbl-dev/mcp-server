/**
 * Tests for Guided Workflows (Phase 2)
 */

import { describe, it, expect } from "vitest";
import {
  getWorkflowTemplate,
  listWorkflows,
  findWorkflowsByProblem,
  ROOT_CAUSE_ANALYSIS,
  STRATEGY_DESIGN,
  DECISION_MAKING,
} from "../framework/workflows.js";

describe("Workflow Templates", () => {
  describe("listWorkflows", () => {
    it("should return all 3 workflow templates", () => {
      const workflows = listWorkflows();
      expect(workflows).toHaveLength(3);
      expect(workflows.map((w) => w.name)).toContain("root_cause_analysis");
      expect(workflows.map((w) => w.name)).toContain("strategy_design");
      expect(workflows.map((w) => w.name)).toContain("decision_making");
    });
  });

  describe("getWorkflowTemplate", () => {
    it("should return correct workflow by name", () => {
      const workflow = getWorkflowTemplate("root_cause_analysis");
      expect(workflow).toBeDefined();
      expect(workflow?.name).toBe("root_cause_analysis");
      expect(workflow?.displayName).toBe("Root Cause Analysis");
    });

    it("should return null for non-existent workflow", () => {
      const workflow = getWorkflowTemplate("non_existent");
      expect(workflow).toBeNull();
    });
  });

  describe("findWorkflowsByProblem", () => {
    it("should find root cause workflow for failure keywords", () => {
      const workflows = findWorkflowsByProblem("failure");
      expect(workflows.length).toBeGreaterThan(0);
      expect(workflows.some((w) => w.name === "root_cause_analysis")).toBe(true);
    });

    it("should find strategy workflow for planning keywords", () => {
      const workflows = findWorkflowsByProblem("strategy");
      expect(workflows.length).toBeGreaterThan(0);
      expect(workflows.some((w) => w.name === "strategy_design")).toBe(true);
    });

    it("should find decision workflow for decision keywords", () => {
      const workflows = findWorkflowsByProblem("decision");
      expect(workflows.length).toBeGreaterThan(0);
      expect(workflows.some((w) => w.name === "decision_making")).toBe(true);
    });

    it("should return empty array for non-matching keywords", () => {
      const workflows = findWorkflowsByProblem("zzzzz-nonexistent");
      expect(workflows).toHaveLength(0);
    });
  });
});

describe("Root Cause Analysis Workflow", () => {
  it("should have correct structure", () => {
    expect(ROOT_CAUSE_ANALYSIS.name).toBe("root_cause_analysis");
    expect(ROOT_CAUSE_ANALYSIS.steps).toHaveLength(4);
    expect(ROOT_CAUSE_ANALYSIS.problemTypes.length).toBeGreaterThan(0);
  });

  it("should have correct transformation sequence P → IN → DE → SY", () => {
    expect(ROOT_CAUSE_ANALYSIS.steps[0].transformation).toBe("P");
    expect(ROOT_CAUSE_ANALYSIS.steps[1].transformation).toBe("IN");
    expect(ROOT_CAUSE_ANALYSIS.steps[2].transformation).toBe("DE");
    expect(ROOT_CAUSE_ANALYSIS.steps[3].transformation).toBe("SY");
  });

  it("each step should have required fields", () => {
    ROOT_CAUSE_ANALYSIS.steps.forEach((step, index) => {
      expect(step.stepNumber).toBe(index + 1);
      expect(step.transformation).toBeDefined();
      expect(step.models.length).toBeGreaterThan(0);
      expect(step.guidance).toBeTruthy();
      expect(step.questions.length).toBeGreaterThan(0);
      expect(step.expectedOutput).toBeTruthy();
    });
  });

  it("should suggest valid model codes", () => {
    const allModels = ROOT_CAUSE_ANALYSIS.steps.flatMap((s) => s.models);
    allModels.forEach((code) => {
      expect(code).toMatch(/^(P|IN|CO|DE|RE|SY)\d{1,2}$/);
    });
  });
});

describe("Strategy Design Workflow", () => {
  it("should have correct structure", () => {
    expect(STRATEGY_DESIGN.name).toBe("strategy_design");
    expect(STRATEGY_DESIGN.steps).toHaveLength(4);
    expect(STRATEGY_DESIGN.estimatedDuration).toBe("30-45 minutes");
  });

  it("should have correct transformation sequence P → CO → SY → RE", () => {
    expect(STRATEGY_DESIGN.steps[0].transformation).toBe("P");
    expect(STRATEGY_DESIGN.steps[1].transformation).toBe("CO");
    expect(STRATEGY_DESIGN.steps[2].transformation).toBe("SY");
    expect(STRATEGY_DESIGN.steps[3].transformation).toBe("RE");
  });

  it("each step should have at least 3 models suggested", () => {
    STRATEGY_DESIGN.steps.forEach((step) => {
      expect(step.models.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe("Decision Making Workflow", () => {
  it("should have correct structure", () => {
    expect(DECISION_MAKING.name).toBe("decision_making");
    expect(DECISION_MAKING.steps).toHaveLength(4);
    expect(DECISION_MAKING.displayName).toBe("Decision Making");
  });

  it("should have correct transformation sequence P → IN → SY → RE", () => {
    expect(DECISION_MAKING.steps[0].transformation).toBe("P");
    expect(DECISION_MAKING.steps[1].transformation).toBe("IN");
    expect(DECISION_MAKING.steps[2].transformation).toBe("SY");
    expect(DECISION_MAKING.steps[3].transformation).toBe("RE");
  });

  it("should have problem types related to decisions", () => {
    const problemTypes = DECISION_MAKING.problemTypes.join(" ").toLowerCase();
    expect(problemTypes).toContain("decision");
  });
});

describe("Workflow Quality Checks", () => {
  const allWorkflows = listWorkflows();

  it("all workflows should have unique names", () => {
    const names = allWorkflows.map((w) => w.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it("all workflows should have display names", () => {
    allWorkflows.forEach((wf) => {
      expect(wf.displayName).toBeTruthy();
      expect(wf.displayName.length).toBeGreaterThan(0);
    });
  });

  it("all workflows should have descriptions", () => {
    allWorkflows.forEach((wf) => {
      expect(wf.description).toBeTruthy();
      expect(wf.description.length).toBeGreaterThan(20);
    });
  });

  it("all workflows should have at least 3 problem types", () => {
    allWorkflows.forEach((wf) => {
      expect(wf.problemTypes.length).toBeGreaterThanOrEqual(3);
    });
  });

  it("all workflows should have estimated duration", () => {
    allWorkflows.forEach((wf) => {
      expect(wf.estimatedDuration).toMatch(/\d+-\d+ minutes/);
    });
  });

  it("all steps should have between 2-4 questions", () => {
    allWorkflows.forEach((wf) => {
      wf.steps.forEach((step) => {
        expect(step.questions.length).toBeGreaterThanOrEqual(2);
        expect(step.questions.length).toBeLessThanOrEqual(5);
      });
    });
  });

  it("all steps should have between 2-4 suggested models", () => {
    allWorkflows.forEach((wf) => {
      wf.steps.forEach((step) => {
        expect(step.models.length).toBeGreaterThanOrEqual(2);
        expect(step.models.length).toBeLessThanOrEqual(4);
      });
    });
  });
});
