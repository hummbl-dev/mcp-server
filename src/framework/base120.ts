/**
 * HUMMBL Base120 Mental Models Framework
 * Version: 1.0-beta (Definitive Reference)
 * Validation Date: October 16, 2025
 * Quality Score: 9.2/10
 */

import type { MentalModel, Transformation, TransformationType } from "../types/domain.js";

export const TRANSFORMATIONS: Record<string, Transformation> = {
  P: {
    key: "P",
    name: "Perspective",
    description: "Frame and name what is. Anchor or shift point of view.",
    models: [
      {
        code: "P1",
        name: "First Principles Framing",
        definition:
          "Reduce complex problems to foundational truths that cannot be further simplified",
        priority: 1,
      },
      {
        code: "P2",
        name: "Stakeholder Mapping",
        definition:
          "Identify all parties with interest, influence, or impact in a system or decision",
        priority: 1,
      },
      {
        code: "P3",
        name: "Identity Stack",
        definition:
          "Recognize that individuals operate from multiple nested identities simultaneously",
        priority: 2,
      },
      {
        code: "P4",
        name: "Lens Shifting",
        definition: "Deliberately adopt different interpretive frameworks to reveal hidden aspects",
        priority: 1,
      },
      {
        code: "P5",
        name: "Empathy Mapping",
        definition:
          "Systematically capture what stakeholders see, think, feel, and do in their context",
        priority: 2,
      },
      {
        code: "P6",
        name: "Point-of-View Anchoring",
        definition: "Establish and maintain a consistent reference frame before analysis begins",
        priority: 3,
      },
      {
        code: "P7",
        name: "Perspective Switching",
        definition: "Rotate through multiple viewpoints to identify invariants and blind spots",
        priority: 2,
      },
      {
        code: "P8",
        name: "Narrative Framing",
        definition:
          "Structure information as causal stories with conflict, choice, and consequence",
        priority: 3,
      },
      {
        code: "P9",
        name: "Cultural Lens Shifting",
        definition:
          "Adjust communication and interpretation for different cultural contexts and norms",
        priority: 4,
      },
      {
        code: "P10",
        name: "Context Windowing",
        definition: "Define explicit boundaries in time, space, and scope for analysis or action",
        priority: 2,
      },
      {
        code: "P11",
        name: "Role Perspective-Taking",
        definition: "Temporarily inhabit specific roles to understand constraints and priorities",
        priority: 3,
      },
      {
        code: "P12",
        name: "Temporal Framing",
        definition:
          "Organize understanding across past causes, present states, and future implications",
        priority: 3,
      },
      {
        code: "P13",
        name: "Spatial Framing",
        definition: "Scale perspective from local details to global patterns and back",
        priority: 4,
      },
      {
        code: "P14",
        name: "Reference Class Framing",
        definition: "Select comparable situations to inform judgment and avoid uniqueness bias",
        priority: 3,
      },
      {
        code: "P15",
        name: "Assumption Surfacing",
        definition: "Explicitly identify and document beliefs underlying plans or models",
        priority: 2,
      },
      {
        code: "P16",
        name: "Identity-Context Reciprocity",
        definition:
          "Recognize how identities shape interpretations and contexts reinforce identities",
        priority: 5,
      },
      {
        code: "P17",
        name: "Frame Control & Reframing",
        definition: "Consciously select or reshape interpretive frames to enable new solutions",
        priority: 2,
      },
      {
        code: "P18",
        name: "Boundary Object Selection",
        definition:
          "Choose representations that bridge multiple perspectives while remaining meaningful",
        priority: 4,
      },
      {
        code: "P19",
        name: "Sensemaking Canvases",
        definition:
          "Deploy structured templates to systematically capture and organize observations",
        priority: 3,
      },
      {
        code: "P20",
        name: "Worldview Articulation",
        definition:
          "Make explicit the fundamental beliefs and values that drive interpretation and action",
        priority: 4,
      },
    ],
  },
  IN: {
    key: "IN",
    name: "Inversion",
    description: "Reverse assumptions. Examine opposites, edges, negations.",
    models: [
      {
        code: "IN1",
        name: "Subtractive Thinking",
        definition: "Improve systems by removing elements rather than adding complexity",
        priority: 1,
      },
      {
        code: "IN2",
        name: "Premortem Analysis",
        definition: "Assume failure has occurred and work backward to identify causes",
        priority: 1,
      },
      {
        code: "IN3",
        name: "Problem Reversal",
        definition: "Solve the inverse of the stated problem to reveal insights",
        priority: 2,
      },
      {
        code: "IN4",
        name: "Contra-Logic",
        definition:
          "Argue the opposite position to stress-test assumptions and expose weak reasoning",
        priority: 2,
      },
      {
        code: "IN5",
        name: "Negative Space Framing",
        definition: "Study what is absent rather than what is present",
        priority: 3,
      },
      {
        code: "IN6",
        name: "Inverse/Proof by Contradiction",
        definition:
          "Assume a claim is false, derive logical impossibility, thus proving the claim true",
        priority: 3,
      },
      {
        code: "IN7",
        name: "Boundary Testing",
        definition: "Explore extreme conditions to find system limits and breaking points",
        priority: 2,
      },
      {
        code: "IN8",
        name: "Contrapositive Reasoning",
        definition: "Use logical equivalence that if A then B equals if not B then not A",
        priority: 4,
      },
      {
        code: "IN9",
        name: "Backward Induction",
        definition: "Begin with desired end state and work backward to determine necessary steps",
        priority: 2,
      },
      {
        code: "IN10",
        name: "Red Teaming",
        definition: "Organize adversarial review to find vulnerabilities through simulated attack",
        priority: 2,
      },
      {
        code: "IN11",
        name: "Devil's Advocate Protocol",
        definition: "Assign explicit role to argue against group consensus or preferred option",
        priority: 3,
      },
      {
        code: "IN12",
        name: "Failure First Design",
        definition:
          "Begin planning by identifying all possible failure modes and designing to prevent them",
        priority: 3,
      },
      {
        code: "IN13",
        name: "Opportunity Cost Focus",
        definition: "Evaluate options by what must be forgone rather than what is gained",
        priority: 2,
      },
      {
        code: "IN14",
        name: "Second-Order Effects (Inverted)",
        definition: "Trace negative downstream consequences rather than immediate benefits",
        priority: 3,
      },
      {
        code: "IN15",
        name: "Constraint Reversal",
        definition: "Temporarily remove assumed constraints to explore alternative solution space",
        priority: 2,
      },
      {
        code: "IN16",
        name: "Inverse Optimization",
        definition: "Maximize worst outcomes to understand system vulnerabilities",
        priority: 4,
      },
      {
        code: "IN17",
        name: "Counterfactual Negation",
        definition: "Imagine outcomes if key decision had been reversed",
        priority: 4,
      },
      {
        code: "IN18",
        name: "Kill-Criteria & Stop Rules",
        definition: "Define conditions that trigger project termination before launch",
        priority: 3,
      },
      {
        code: "IN19",
        name: "Harm Minimization (Via Negativa)",
        definition: "Improve by removing harmful elements rather than adding beneficial ones",
        priority: 3,
      },
      {
        code: "IN20",
        name: "Antigoals & Anti-Patterns Catalog",
        definition: "Document failure modes to avoid rather than success patterns to emulate",
        priority: 4,
      },
    ],
  },
  CO: {
    key: "CO",
    name: "Composition",
    description: "Combine parts into coherent wholes.",
    models: [
      {
        code: "CO1",
        name: "Synergy Principle",
        definition: "Design combinations where integrated value exceeds sum of parts",
        priority: 1,
      },
      {
        code: "CO2",
        name: "Chunking",
        definition: "Group related elements into meaningful units to reduce cognitive load",
        priority: 1,
      },
      {
        code: "CO3",
        name: "Functional Composition",
        definition: "Chain pure operations where output of one becomes input of next",
        priority: 2,
      },
      {
        code: "CO4",
        name: "Interdisciplinary Synthesis",
        definition: "Merge insights from distinct fields to generate novel solutions",
        priority: 2,
      },
      {
        code: "CO5",
        name: "Emergence",
        definition: "Recognize higher-order behavior arising from component interactions",
        priority: 2,
      },
      {
        code: "CO6",
        name: "Gestalt Integration",
        definition: "Perceive and leverage whole patterns rather than isolated components",
        priority: 3,
      },
      {
        code: "CO7",
        name: "Network Effects",
        definition: "Exploit increasing value as user base or connections grow",
        priority: 2,
      },
      {
        code: "CO8",
        name: "Layered Abstraction",
        definition: "Separate concerns into hierarchical levels with clear interfaces between them",
        priority: 2,
      },
      {
        code: "CO9",
        name: "Interface Contracts",
        definition:
          "Define explicit agreements about data structures and behavior between components",
        priority: 3,
      },
      {
        code: "CO10",
        name: "Pipeline Orchestration",
        definition: "Coordinate sequential stages with explicit handoffs and error handling",
        priority: 3,
      },
      {
        code: "CO11",
        name: "Pattern Composition (Tiling)",
        definition: "Combine repeating elements to construct complex structures efficiently",
        priority: 4,
      },
      {
        code: "CO12",
        name: "Modular Interoperability",
        definition: "Ensure independent components work together through standardized connections",
        priority: 3,
      },
      {
        code: "CO13",
        name: "Cross-Domain Analogy",
        definition: "Transfer solution patterns from one domain to solve problems in another",
        priority: 2,
      },
      {
        code: "CO14",
        name: "Platformization",
        definition:
          "Extract common capabilities into reusable infrastructure serving multiple use cases",
        priority: 3,
      },
      {
        code: "CO15",
        name: "Combinatorial Design",
        definition: "Systematically explore option combinations to find optimal configurations",
        priority: 4,
      },
      {
        code: "CO16",
        name: "System Integration Testing",
        definition: "Verify assembled components work correctly together, not just in isolation",
        priority: 3,
      },
      {
        code: "CO17",
        name: "Orchestration vs Choreography",
        definition:
          "Choose between centralized coordination or distributed peer-to-peer interaction",
        priority: 4,
      },
      {
        code: "CO18",
        name: "Knowledge Graphing",
        definition: "Represent information as interconnected entities and relationships",
        priority: 3,
      },
      {
        code: "CO19",
        name: "Multi-Modal Integration",
        definition: "Synthesize information from different sensory or data modalities",
        priority: 4,
      },
      {
        code: "CO20",
        name: "Holistic Integration",
        definition:
          "Unify disparate elements into coherent, seamless whole where boundaries dissolve",
        priority: 4,
      },
    ],
  },
  DE: {
    key: "DE",
    name: "Decomposition",
    description: "Break complex systems into constituent parts.",
    models: [
      {
        code: "DE1",
        name: "Root Cause Analysis (5 Whys)",
        definition: "Iteratively ask why problems occur until fundamental cause emerges",
        priority: 1,
      },
      {
        code: "DE2",
        name: "Factorization",
        definition:
          "Separate multiplicative components to understand relative contribution of each factor",
        priority: 2,
      },
      {
        code: "DE3",
        name: "Modularization",
        definition: "Partition system into self-contained units with minimal interdependencies",
        priority: 1,
      },
      {
        code: "DE4",
        name: "Layered Breakdown",
        definition: "Decompose from system to subsystem to component progressively",
        priority: 2,
      },
      {
        code: "DE5",
        name: "Dimensional Reduction",
        definition: "Focus on most informative variables while discarding noise or redundancy",
        priority: 3,
      },
      {
        code: "DE6",
        name: "Taxonomy/Classification",
        definition: "Organize entities into hierarchical categories based on shared properties",
        priority: 2,
      },
      {
        code: "DE7",
        name: "Pareto Decomposition (80/20)",
        definition: "Identify vital few drivers producing most impact versus trivial many",
        priority: 1,
      },
      {
        code: "DE8",
        name: "Work Breakdown Structure",
        definition:
          "Hierarchically divide project into deliverable-oriented components with clear ownership",
        priority: 2,
      },
      {
        code: "DE9",
        name: "Signal Separation",
        definition: "Distinguish meaningful patterns from random variation or confounding factors",
        priority: 3,
      },
      {
        code: "DE10",
        name: "Abstraction Laddering",
        definition: "Move up and down conceptual hierarchy to find appropriate solution level",
        priority: 3,
      },
      {
        code: "DE11",
        name: "Scope Delimitation",
        definition:
          "Define precise boundaries of what is included versus excluded from consideration",
        priority: 2,
      },
      {
        code: "DE12",
        name: "Constraint Isolation",
        definition: "Identify specific limiting factor preventing performance improvement",
        priority: 2,
      },
      {
        code: "DE13",
        name: "Failure Mode Analysis (FMEA)",
        definition:
          "Enumerate potential failure points with severity, likelihood, and detectability ratings",
        priority: 3,
      },
      {
        code: "DE14",
        name: "Variable Control & Isolation",
        definition: "Hold factors constant to measure single variable's causal impact",
        priority: 3,
      },
      {
        code: "DE15",
        name: "Decision Tree Expansion",
        definition: "Map choices and their consequences as branching paths",
        priority: 2,
      },
      {
        code: "DE16",
        name: "Hypothesis Disaggregation",
        definition: "Break compound claim into testable sub-hypotheses",
        priority: 3,
      },
      {
        code: "DE17",
        name: "Orthogonalization",
        definition: "Ensure factors vary independently without correlation or interdependence",
        priority: 4,
      },
      {
        code: "DE18",
        name: "Scenario Decomposition",
        definition: "Partition future possibilities into discrete, mutually exclusive scenarios",
        priority: 3,
      },
      {
        code: "DE19",
        name: "Critical Path Unwinding",
        definition:
          "Trace longest sequence of dependent tasks determining minimum project duration",
        priority: 3,
      },
      {
        code: "DE20",
        name: "Partition-and-Conquer",
        definition: "Divide problem into independent subproblems solvable separately then combined",
        priority: 2,
      },
    ],
  },
  RE: {
    key: "RE",
    name: "Recursion",
    description: "Apply operations iteratively, with outputs becoming inputs.",
    models: [
      {
        code: "RE1",
        name: "Recursive Improvement (Kaizen)",
        definition: "Continuously refine process through small, frequent enhancements",
        priority: 1,
      },
      {
        code: "RE2",
        name: "Feedback Loops",
        definition: "Create mechanisms where system outputs influence future inputs",
        priority: 1,
      },
      {
        code: "RE3",
        name: "Meta-Learning (Learn-to-Learn)",
        definition: "Improve the process of learning itself, not just domain knowledge",
        priority: 2,
      },
      {
        code: "RE4",
        name: "Nested Narratives",
        definition: "Structure information as stories within stories for depth and memorability",
        priority: 4,
      },
      {
        code: "RE5",
        name: "Fractal Reasoning",
        definition: "Recognize self-similar patterns repeating across different scales",
        priority: 3,
      },
      {
        code: "RE6",
        name: "Recursive Framing",
        definition: "Apply mental models to the process of selecting mental models",
        priority: 3,
      },
      {
        code: "RE7",
        name: "Self-Referential Logic",
        definition: "Create systems that monitor, measure, or modify themselves",
        priority: 3,
      },
      {
        code: "RE8",
        name: "Bootstrapping",
        definition:
          "Build capability using currently available resources, then use that to build more",
        priority: 2,
      },
      {
        code: "RE9",
        name: "Iterative Prototyping",
        definition: "Cycle rapidly through build-test-learn loops with increasing fidelity",
        priority: 1,
      },
      {
        code: "RE10",
        name: "Compounding Cycles",
        definition: "Design systems where gains reinforce future gains exponentially",
        priority: 2,
      },
      {
        code: "RE11",
        name: "Calibration Loops",
        definition: "Repeatedly check predictions against outcomes to improve forecasting accuracy",
        priority: 3,
      },
      {
        code: "RE12",
        name: "Bayesian Updating in Practice",
        definition: "Continuously revise beliefs as new evidence arrives, weighting by reliability",
        priority: 3,
      },
      {
        code: "RE13",
        name: "Gradient Descent Heuristic",
        definition:
          "Iteratively adjust toward improvement, even without perfect knowledge of optimal direction",
        priority: 3,
      },
      {
        code: "RE14",
        name: "Spiral Learning",
        definition: "Revisit concepts at increasing depth, building on previous understanding",
        priority: 4,
      },
      {
        code: "RE15",
        name: "Convergence-Divergence Cycling",
        definition: "Alternate between expanding possibilities and narrowing to decisions",
        priority: 2,
      },
      {
        code: "RE16",
        name: "Retrospective→Prospective Loop",
        definition: "Use systematic reflection on past to inform future planning",
        priority: 2,
      },
      {
        code: "RE17",
        name: "Versioning & Diff",
        definition: "Track changes over time and compare versions to understand evolution",
        priority: 3,
      },
      {
        code: "RE18",
        name: "Anti-Catastrophic Forgetting",
        definition: "Preserve critical knowledge while adapting to new information",
        priority: 4,
      },
      {
        code: "RE19",
        name: "Auto-Refactor",
        definition: "Systematically improve system structure without changing external behavior",
        priority: 4,
      },
      {
        code: "RE20",
        name: "Recursive Governance (Guardrails that Learn)",
        definition: "Establish rules that adapt based on their own effectiveness",
        priority: 5,
      },
    ],
  },
  SY: {
    key: "SY",
    name: "Meta-Systems",
    description: "Understand systems of systems, coordination, and emergent dynamics.",
    models: [
      {
        code: "SY1",
        name: "Leverage Points",
        definition:
          "Identify intervention points where small changes produce disproportionate effects",
        priority: 1,
      },
      {
        code: "SY2",
        name: "System Boundaries",
        definition: "Define what is inside versus outside system scope for analysis or design",
        priority: 1,
      },
      {
        code: "SY3",
        name: "Stocks & Flows",
        definition: "Distinguish accumulations from rates of change affecting them",
        priority: 2,
      },
      {
        code: "SY4",
        name: "Requisite Variety",
        definition: "Match control system's complexity to system being controlled",
        priority: 3,
      },
      {
        code: "SY5",
        name: "Systems Archetypes",
        definition: "Recognize recurring dynamic patterns across different domains",
        priority: 2,
      },
      {
        code: "SY6",
        name: "Feedback Structure Mapping",
        definition: "Diagram causal loops showing how variables influence each other",
        priority: 2,
      },
      {
        code: "SY7",
        name: "Path Dependence",
        definition:
          "Acknowledge how early decisions constrain future options through accumulated consequences",
        priority: 2,
      },
      {
        code: "SY8",
        name: "Homeostasis/Dynamic Equilibrium",
        definition:
          "Understand self-regulating mechanisms maintaining stable states despite disturbances",
        priority: 3,
      },
      {
        code: "SY9",
        name: "Phase Transitions & Tipping Points",
        definition: "Identify thresholds where gradual changes produce sudden qualitative shifts",
        priority: 2,
      },
      {
        code: "SY10",
        name: "Causal Loop Diagrams",
        definition:
          "Visualize circular cause-effect relationships with reinforcing and balancing dynamics",
        priority: 3,
      },
      {
        code: "SY11",
        name: "Governance Patterns",
        definition:
          "Design decision rights, accountability structures, and coordination mechanisms",
        priority: 2,
      },
      {
        code: "SY12",
        name: "Protocol/Interface Standards",
        definition: "Specify rules for interaction enabling coordination without central control",
        priority: 3,
      },
      {
        code: "SY13",
        name: "Incentive Architecture",
        definition:
          "Design reward and penalty structures aligning individual actions with system goals",
        priority: 2,
      },
      {
        code: "SY14",
        name: "Risk & Resilience Engineering",
        definition: "Build systems that fail gracefully and recover automatically",
        priority: 2,
      },
      {
        code: "SY15",
        name: "Multi-Scale Alignment",
        definition:
          "Ensure strategy, operations, and execution cohere across organizational levels",
        priority: 3,
      },
      {
        code: "SY16",
        name: "Ecosystem Strategy",
        definition:
          "Position organization within network of partners, competitors, and stakeholders",
        priority: 3,
      },
      {
        code: "SY17",
        name: "Policy Feedbacks",
        definition:
          "Anticipate how rules shape behavior, which creates conditions affecting future rules",
        priority: 4,
      },
      {
        code: "SY18",
        name: "Measurement & Telemetry",
        definition:
          "Instrument systems to capture state, changes, and anomalies for informed response",
        priority: 2,
      },
      {
        code: "SY19",
        name: "Meta-Model Selection",
        definition: "Choose appropriate framework or tool for specific problem characteristics",
        priority: 1,
      },
      {
        code: "SY20",
        name: "Systems-of-Systems Coordination",
        definition: "Manage interactions between independent systems with emergent behaviors",
        priority: 3,
      },
    ],
  },
};

export const PROBLEM_PATTERNS = [
  { pattern: "Unclear problem definition", transformations: ["P"], topModels: ["P1", "P2", "P4"] },
  {
    pattern: "Stuck in conventional thinking",
    transformations: ["IN"],
    topModels: ["IN1", "IN2", "IN3"],
  },
  {
    pattern: "Need to assemble solution",
    transformations: ["CO"],
    topModels: ["CO1", "CO2", "CO4"],
  },
  {
    pattern: "Complex system to understand",
    transformations: ["DE"],
    topModels: ["DE1", "DE2", "DE7"],
  },
  {
    pattern: "Feedback or iteration issues",
    transformations: ["RE"],
    topModels: ["RE1", "RE2", "RE3"],
  },
  {
    pattern: "Strategic or coordination challenge",
    transformations: ["SY"],
    topModels: ["SY1", "SY2", "SY19"],
  },
];

export function getAllModels(): MentalModel[] {
  return Object.values(TRANSFORMATIONS).flatMap((t) => t.models);
}

export function getModelByCode(code: string): MentalModel | null {
  const allModels = getAllModels();
  return allModels.find((m) => m.code === code.toUpperCase()) || null;
}

export function getTransformationByKey(key: string): Transformation | null {
  return TRANSFORMATIONS[key] || null;
}

export function searchModels(query: string): MentalModel[] {
  const lowerQuery = query.toLowerCase();
  return getAllModels().filter(
    (m) =>
      m.code.toLowerCase().includes(lowerQuery) ||
      m.name.toLowerCase().includes(lowerQuery) ||
      m.definition.toLowerCase().includes(lowerQuery)
  );
}

export function getModelsByPriority(priority: number): MentalModel[] {
  return getAllModels().filter((m) => m.priority === priority);
}

export function getModelsByTransformation(transformationKey: TransformationType): MentalModel[] {
  const trans = TRANSFORMATIONS[transformationKey];
  return trans ? trans.models : [];
}
