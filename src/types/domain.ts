/**
 * HUMMBL Base120 Domain Types
 * Core type definitions for mental models, transformations, and framework operations
 */

export type TransformationType = "P" | "IN" | "CO" | "DE" | "RE" | "SY";

export interface MentalModel {
  code: string;
  name: string;
  definition: string;
  priority: number;
}

export interface Transformation {
  key: TransformationType;
  name: string;
  description: string;
  models: MentalModel[];
}

export interface ProblemPattern {
  pattern: string;
  transformations: TransformationType[];
  topModels: string[];
}

export interface ModelRecommendation {
  model: MentalModel;
  relevance_score: number;
  reasoning: string;
}

export interface AnalysisGuide {
  problem_type: string;
  recommended_approach: string;
  primary_models: string[];
  secondary_models: string[];
  workflow: string[];
}

/**
 * Result type for type-safe error handling (Railway-Oriented Programming).
 */
export type Result<T, E = Error> = { success: true; value: T } | { success: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({
  success: true,
  value,
});

export const err = <E>(error: E): Result<never, E> => ({
  success: false,
  error,
});

/**
 * Type guard for Result success case.
 */
export function isOk<T, E>(result: Result<T, E>): result is { success: true; value: T } {
  return result.success === true;
}

/**
 * Type guard for Result error case.
 */
export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

/**
 * Workflow types for guided multi-turn problem solving
 */

export type WorkflowType = "root_cause_analysis" | "strategy_design" | "decision_making";

export interface WorkflowStep {
  stepNumber: number;
  transformation: TransformationType;
  models: string[]; // Model codes to apply
  guidance: string; // What to do in this step
  questions: string[]; // Prompts to guide thinking
  expectedOutput: string; // What should result from this step
}

export interface WorkflowTemplate {
  name: WorkflowType;
  displayName: string;
  description: string;
  problemTypes: string[]; // When to use this workflow
  steps: WorkflowStep[];
  estimatedDuration: string; // e.g., "15-30 minutes"
}

export interface WorkflowState {
  workflowName: WorkflowType;
  currentStep: number;
  totalSteps: number;
  startedAt: string;
  lastUpdatedAt: string;
  completed: boolean;
  stepResults: Record<number, string>; // User's insights from each step
}

export interface WorkflowProgress {
  workflow: WorkflowType;
  displayName: string;
  currentStep: number;
  totalSteps: number;
  transformation: TransformationType;
  guidance: string;
  suggestedModels: string[];
  questions: string[];
  nextAction: string;
  canResume: boolean;
}
