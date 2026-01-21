/**
 * HUMMBL Guided Workflow Templates
 * Multi-turn problem-solving workflows using mental models
 * Phase 2 Implementation
 */

import type { WorkflowTemplate } from "../types/domain.js";

/**
 * Root Cause Analysis Workflow
 * Use when: Problem occurred, need to understand why
 * Transformation sequence: P → IN → DE
 */
export const ROOT_CAUSE_ANALYSIS: WorkflowTemplate = {
  name: "root_cause_analysis",
  displayName: "Root Cause Analysis",
  description:
    "Systematically investigate problems to find root causes, not just symptoms. Uses Perspective, Inversion, and Decomposition transformations.",
  problemTypes: [
    "Production failure or incident",
    "Recurring problem without clear cause",
    "System breakdown or degradation",
    "Quality issues or defects",
    "Process failures",
  ],
  estimatedDuration: "20-30 minutes",
  steps: [
    {
      stepNumber: 1,
      transformation: "P",
      models: ["P1", "P2", "P15"],
      guidance:
        "Frame the problem clearly from multiple perspectives. Strip away assumptions and identify all stakeholders affected.",
      questions: [
        "What are the foundational facts we know for certain? (P1: First Principles)",
        "Who is affected by this problem and how? (P2: Stakeholder Mapping)",
        "What assumptions are we making about the problem? (P15: Assumption Surfacing)",
        "How would different stakeholders describe this problem?",
      ],
      expectedOutput:
        "Clear problem statement with facts separated from assumptions, list of affected stakeholders, and multiple framings of the issue.",
    },
    {
      stepNumber: 2,
      transformation: "IN",
      models: ["IN2", "IN7", "IN5"],
      guidance:
        "Assume the problem already happened and work backward. Test boundaries and examine what's absent.",
      questions: [
        "If we did a premortem 6 months ago, what would we have predicted would fail? (IN2: Premortem)",
        "At what point does the system break? What are the edge cases? (IN7: Boundary Testing)",
        "What is conspicuously absent that should be present? (IN5: Negative Space)",
        "What didn't happen that we expected to happen?",
      ],
      expectedOutput:
        "List of potential failure modes, identified edge cases, gaps or absences that contributed to the problem.",
    },
    {
      stepNumber: 3,
      transformation: "DE",
      models: ["DE1", "DE2", "DE6"],
      guidance:
        "Break down the system to isolate the failure point. Trace dependencies and identify the specific component that failed.",
      questions: [
        "What are the independent modules or components involved? (DE1: Modular Decomposition)",
        "Which layer of the system failed - infrastructure, service, or interface? (DE2: Layered Architecture)",
        "What dependencies or cascading effects occurred? (DE6: Dependency Mapping)",
        "If we isolate each component, which one reproduces the failure?",
      ],
      expectedOutput:
        "Specific component or interaction that caused the failure, understanding of cascading effects, clear root cause identified.",
    },
    {
      stepNumber: 4,
      transformation: "SY",
      models: ["SY1", "SY5", "SY10"],
      guidance:
        "Understand the systemic patterns that allowed this failure. Identify feedback loops and systemic fixes.",
      questions: [
        "What feedback loops exist that could prevent this in the future? (SY1: Feedback Loops)",
        "Is this failure a symptom of a larger system issue? (SY5: Emergent Properties)",
        "What monitoring or early warning system would catch this? (SY10: Observability Patterns)",
        "How do we prevent this class of problems, not just this instance?",
      ],
      expectedOutput:
        "Systemic improvements identified, prevention mechanisms designed, monitoring enhanced to catch similar issues early.",
    },
  ],
};

/**
 * Strategy Design Workflow
 * Use when: Creating a strategy, planning a major initiative
 * Transformation sequence: P → CO → SY
 */
export const STRATEGY_DESIGN: WorkflowTemplate = {
  name: "strategy_design",
  displayName: "Strategy Design",
  description:
    "Design comprehensive strategies by framing the problem, combining elements creatively, and understanding system dynamics.",
  problemTypes: [
    "Building a product strategy",
    "Organizational transformation",
    "Market entry planning",
    "Long-term business planning",
    "Innovation initiatives",
  ],
  estimatedDuration: "30-45 minutes",
  steps: [
    {
      stepNumber: 1,
      transformation: "P",
      models: ["P4", "P7", "P12"],
      guidance:
        "View the strategic landscape from multiple angles. Understand past trends, present state, and future implications.",
      questions: [
        "What lens should we use - customer, competitor, technology, regulatory? (P4: Lens Shifting)",
        "How does this look from different stakeholder perspectives? (P7: Perspective Switching)",
        "What historical patterns led here? Where might this trend in the future? (P12: Temporal Framing)",
        "What invariants remain true across all perspectives?",
      ],
      expectedOutput:
        "Multi-perspective understanding of the strategic landscape, historical context, future trajectories identified.",
    },
    {
      stepNumber: 2,
      transformation: "CO",
      models: ["CO2", "CO4", "CO5"],
      guidance:
        "Generate strategic options by combining ideas from different domains and synthesizing opposing forces.",
      questions: [
        "What ideas from other industries could we borrow? (CO2: Cross-Pollination)",
        "How can we synthesize opposing forces (e.g., premium + accessible)? (CO4: Synthesis)",
        "What unusual combinations might create competitive advantage? (CO5: Combinatorial Innovation)",
        "What if we combined our strengths in unexpected ways?",
      ],
      expectedOutput:
        "3-5 strategic options generated, each combining distinct elements, with clear differentiation rationale.",
    },
    {
      stepNumber: 3,
      transformation: "SY",
      models: ["SY2", "SY3", "SY19"],
      guidance:
        "Evaluate strategies through systems thinking. Design incentives, model decisions, and understand ecosystem dynamics.",
      questions: [
        "How do we align incentives across stakeholders? (SY2: Incentive Design)",
        "What are the decision points and payoff structures? (SY3: Decision Trees)",
        "How does this strategy fit in the broader ecosystem? (SY19: Ecosystem Thinking)",
        "What second-order and third-order effects might occur?",
      ],
      expectedOutput:
        "Selected strategy with aligned incentives, decision framework for execution, ecosystem positioning clear.",
    },
    {
      stepNumber: 4,
      transformation: "RE",
      models: ["RE1", "RE4", "RE8"],
      guidance:
        "Plan iterative execution. Build feedback loops and define how to evolve the strategy over time.",
      questions: [
        "What's our MVP and how do we iterate from there? (RE1: Iterative Refinement)",
        "What metrics and feedback loops will guide our evolution? (RE4: Feedback-Driven Development)",
        "How do we stage the rollout - pilot, scale, optimize? (RE8: Phased Implementation)",
        "What learning loops ensure we adapt as we execute?",
      ],
      expectedOutput:
        "Phased execution plan with clear milestones, feedback mechanisms defined, iteration strategy established.",
    },
  ],
};

/**
 * Decision Making Workflow
 * Use when: Facing a difficult decision with high stakes
 * Transformation sequence: P → IN → RE
 */
export const DECISION_MAKING: WorkflowTemplate = {
  name: "decision_making",
  displayName: "Decision Making",
  description:
    "Make high-quality decisions by framing clearly, stress-testing with inversion, and planning reversible vs. irreversible choices.",
  problemTypes: [
    "Critical business decisions",
    "Technology choices (build vs. buy)",
    "Hiring decisions",
    "Strategic pivots",
    "Resource allocation",
  ],
  estimatedDuration: "15-25 minutes",
  steps: [
    {
      stepNumber: 1,
      transformation: "P",
      models: ["P1", "P6", "P17"],
      guidance:
        "Frame the decision clearly. What are we really deciding? What's the reference frame?",
      questions: [
        "What is the core decision, stripped of ancillary concerns? (P1: First Principles)",
        "From whose point of view are we making this decision? (P6: Point-of-View Anchoring)",
        "How does reframing change the decision space? (P17: Frame Control)",
        "What decision are we NOT making? (Boundary the decision)",
      ],
      expectedOutput:
        "Crystal clear decision statement, explicit point of view, boundaries defined (what's in scope, what's not).",
    },
    {
      stepNumber: 2,
      transformation: "IN",
      models: ["IN2", "IN4", "IN6"],
      guidance:
        "Stress-test the decision. Assume we're wrong and work backward. Argue the opposite position.",
      questions: [
        "If this decision fails spectacularly, what went wrong? (IN2: Premortem)",
        "What's the strongest argument AGAINST our preferred option? (IN4: Contra-Logic)",
        "Can we prove our reasoning false? Where are the logical gaps? (IN6: Proof by Contradiction)",
        "What assumptions, if wrong, invalidate this decision?",
      ],
      expectedOutput:
        "Identified failure modes, strongest counterarguments documented, assumptions that must hold true for success.",
    },
    {
      stepNumber: 3,
      transformation: "SY",
      models: ["SY3", "SY6", "SY11"],
      guidance:
        "Model the decision systematically. Understand payoffs, constraints, and optionality.",
      questions: [
        "What's the decision tree and payoff matrix? (SY3: Decision Trees)",
        "What constraints must we respect? (SY6: Constraint Satisfaction)",
        "Is this reversible or one-way? How much optionality do we preserve? (SY11: Option Value)",
        "What information would change our decision?",
      ],
      expectedOutput:
        "Decision tree with payoffs mapped, constraints explicit, reversibility assessed, option value understood.",
    },
    {
      stepNumber: 4,
      transformation: "RE",
      models: ["RE5", "RE7", "RE10"],
      guidance:
        "Plan execution with learning loops. Define success criteria and how we'll adapt if needed.",
      questions: [
        "What would falsify our decision? What metrics prove us right or wrong? (RE5: Falsification Framework)",
        "How do we build in checkpoints to reassess? (RE7: Checkpoint-Driven Execution)",
        "What feedback signals tell us to stay the course or pivot? (RE10: Adaptive Decision Loops)",
        "If we could only undo this decision at specific gates, when are they?",
      ],
      expectedOutput:
        "Decision made with conviction, success criteria defined, checkpoints established, adaptation strategy clear.",
    },
  ],
};

/**
 * All available workflow templates
 */
export const WORKFLOW_TEMPLATES: Record<string, WorkflowTemplate> = {
  root_cause_analysis: ROOT_CAUSE_ANALYSIS,
  strategy_design: STRATEGY_DESIGN,
  decision_making: DECISION_MAKING,
};

/**
 * Get a workflow template by name
 */
export function getWorkflowTemplate(name: string): WorkflowTemplate | null {
  return WORKFLOW_TEMPLATES[name] || null;
}

/**
 * List all available workflows
 */
export function listWorkflows(): WorkflowTemplate[] {
  return Object.values(WORKFLOW_TEMPLATES);
}

/**
 * Find workflows by problem type keyword
 */
export function findWorkflowsByProblem(query: string): WorkflowTemplate[] {
  const lowerQuery = query.toLowerCase();
  return listWorkflows().filter((wf) =>
    wf.problemTypes.some((pt) => pt.toLowerCase().includes(lowerQuery))
  );
}
