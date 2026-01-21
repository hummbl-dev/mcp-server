/**
 * HUMMBL Base120 Domain Types
 * Core type definitions for mental models, transformations, and framework operations
 */

export type TransformationType = "P" | "IN" | "CO" | "DE" | "RE" | "SY";

export const TRANSFORMATION_TYPES: readonly TransformationType[] = [
  "P",
  "IN",
  "CO",
  "DE",
  "RE",
  "SY",
] as const;

export const isTransformationType = (value: unknown): value is TransformationType => {
  if (typeof value !== "string") {
    return false;
  }
  return TRANSFORMATION_TYPES.includes(value as TransformationType);
};

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

export type DialecticalStageId =
  | "thesis"
  | "antithesis"
  | "synthesis"
  | "convergence"
  | "meta_reflection";

export interface StageModelMapping {
  stage: DialecticalStageId;
  title: string;
  description: string;
  modelCodes: string[];
}

export interface DialecticalMethodology {
  id: string;
  title: string;
  version: string;
  summary: string;
  documentUrl?: string;
  totalPages?: number;
  modelsReferenced: string[];
  stages: StageModelMapping[];
  metaModels: string[];
}

export type ModelReferenceIssueType = "NotFound" | "WrongTransformation" | "Duplicate" | "Unknown";

export interface ModelReferenceIssue {
  code: string;
  issueType: ModelReferenceIssueType;
  message: string;
  expectedTransformation?: TransformationType;
  actualTransformation?: TransformationType;
}

export interface MethodologyAuditResult {
  methodologyId: string;
  documentVersion: string;
  totalReferences: number;
  validCount: number;
  invalidCount: number;
  issues: ModelReferenceIssue[];
}

/**
 * Domain-wide error type for HUMMBL Base120 operations.
 */
export type DomainError =
  | { type: "NotFound"; entity: string; code?: string }
  | { type: "ValidationError"; field?: string; message: string }
  | { type: "Conflict"; entity: string; message: string }
  | { type: "Internal"; message: string }
  | { type: "Unknown"; message: string };

/**
 * Result type for type-safe error handling (Railway-Oriented Programming).
 * Uses an `ok` discriminant to align with HUMMBL global patterns.
 */
export type Result<T, E = DomainError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({
  ok: true,
  value,
});

export const err = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

/**
 * Type guard for Result success case.
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok === true;
}

/**
 * Type guard for Result error case.
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return result.ok === false;
}

export function isNotFoundError(
  error: DomainError
): error is Extract<DomainError, { type: "NotFound" }> {
  return error.type === "NotFound";
}

/**
 * API Key tiers with rate limits and permissions
 */
export type ApiKeyTier = "free" | "pro" | "enterprise";

export interface ApiKeyInfo {
  id: string;
  key: string;
  tier: ApiKeyTier;
  name: string;
  createdAt: string;
  lastUsed?: string;
  usageCount: number;
  rateLimit: {
    requestsPerHour: number;
    requestsPerDay: number;
  };
  permissions: readonly string[];
  isActive: boolean;
}

/**
 * Authentication result types
 */
export type AuthResult = Result<ApiKeyInfo, AuthError>;

export type AuthError =
  | { type: "MISSING_AUTH"; message: string }
  | { type: "INVALID_FORMAT"; message: string }
  | { type: "KEY_NOT_FOUND"; message: string }
  | { type: "KEY_INACTIVE"; message: string }
  | { type: "RATE_LIMIT_EXCEEDED"; message: string }
  | { type: "INTERNAL_ERROR"; message: string };

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
