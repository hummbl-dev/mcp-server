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
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

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
