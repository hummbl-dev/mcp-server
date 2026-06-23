import {
  type DialecticalMethodology,
  type DomainError,
  type MethodologyAuditResult,
  type ModelReferenceIssue,
  type TransformationType,
  Result,
  err,
  ok,
} from "../types/domain.js";
import { getModelByCode, getTransformationByKey } from "./base120.js";

const METHODOLOGY_ID = "self_dialectical_ai_v1_2";
const METHODOLOGY_VERSION = "1.2";

export const SELF_DIALECTICAL_METHODOLOGY: DialecticalMethodology = {
  id: METHODOLOGY_ID,
  title: "Self-Dialectical AI Systems: A HUMMBL-Informed Methodology for Ethical Self-Correction",
  version: METHODOLOGY_VERSION,
  summary:
    "Enables AI systems to perform ethical self-correction through structured dialectical reasoning integrated with HUMMBL Base120 mental models.",
  documentUrl: undefined,
  totalPages: 60,
  modelsReferenced: [
    "P1",
    "P2",
    "DE3",
    "IN11",
    "IN2",
    "IN10",
    "CO4",
    "CO1",
    "CO20",
    "RE11",
    "RE15",
    "RE1",
    "RE7",
    "RE3",
    "RE16",
    "SY19",
    "SY1",
  ],
  stages: [
    {
      stage: "thesis",
      title: "Stage 1: Thesis Generation",
      description: "Generate and structure the initial ethical position.",
      modelCodes: ["P1", "P2", "DE3"],
    },
    {
      stage: "antithesis",
      title: "Stage 2: Antithesis Development",
      description:
        "Critique thesis via adversarial reasoning, premortem analysis, and red teaming.",
      modelCodes: ["IN11", "IN2", "IN10"],
    },
    {
      stage: "synthesis",
      title: "Stage 3: Synthesis Formation",
      description:
        "Integrate thesis and antithesis into a higher-order resolution across perspectives.",
      modelCodes: ["CO4", "CO1", "CO20"],
    },
    {
      stage: "convergence",
      title: "Stage 4: Convergence Testing",
      description:
        "Test and refine synthesis via calibration loops, convergence/divergence, and recursive improvement.",
      modelCodes: ["RE11", "RE15", "RE1"],
    },
    {
      stage: "meta_reflection",
      title: "Stage 5: Meta-Reflection",
      description:
        "Reflect on and improve the reasoning process itself via self-referential logic and meta-learning.",
      modelCodes: ["RE7", "RE3", "RE16"],
    },
  ],
  metaModels: ["SY19", "SY1"],
};

export function getSelfDialecticalMethodology(): Result<DialecticalMethodology, DomainError> {
  return ok(SELF_DIALECTICAL_METHODOLOGY);
}

export interface AuditInputItem {
  code: string;
  expectedTransformation?: TransformationType;
}

export function auditModelCodes(
  items: AuditInputItem[]
): Result<MethodologyAuditResult, DomainError> {
  if (items.length === 0) {
    return err({
      type: "ValidationError",
      field: "codes",
      message: "At least one model code must be provided for audit.",
    });
  }

  const normalizedItems = items.map((item) => ({
    code: item.code.toUpperCase(),
    expectedTransformation: item.expectedTransformation,
  }));

  const issues: ModelReferenceIssue[] = [];
  let validCount = 0;

  const seen = new Map<string, number>();

  for (const item of normalizedItems) {
    const currentCount = seen.get(item.code) ?? 0;
    seen.set(item.code, currentCount + 1);
  }

  for (const item of normalizedItems) {
    const modelResult = getModelByCode(item.code);

    if (!modelResult.ok) {
      issues.push({
        code: item.code,
        issueType: "NotFound",
        message: `Model code '${item.code}' was not found in HUMMBL Base120.`,
      });
      continue;
    }

    validCount += 1;

    const model = modelResult.value;

    const owningTransformationKey = findTransformationKeyForModel(model.code);

    if (item.expectedTransformation && owningTransformationKey) {
      if (owningTransformationKey !== item.expectedTransformation) {
        issues.push({
          code: item.code,
          issueType: "WrongTransformation",
          message: `Model '${item.code}' belongs to transformation '${owningTransformationKey}', not '${item.expectedTransformation}'.`,
          expectedTransformation: item.expectedTransformation,
          actualTransformation: owningTransformationKey,
        });
      }
    }

    const count = seen.get(item.code) ?? 0;
    if (count > 1) {
      issues.push({
        code: item.code,
        issueType: "Duplicate",
        message: `Model code '${item.code}' appears ${count} times in the provided references.`,
      });
    }
  }

  const totalReferences = normalizedItems.length;
  const invalidCount = issues.length;

  const result: MethodologyAuditResult = {
    methodologyId: METHODOLOGY_ID,
    documentVersion: METHODOLOGY_VERSION,
    totalReferences,
    validCount,
    invalidCount,
    issues,
  };

  return ok(result);
}

function findTransformationKeyForModel(code: string): TransformationType | undefined {
  const transformationResult = getTransformationByKeyForModel(code);
  if (!transformationResult.ok) {
    return undefined;
  }
  return transformationResult.value;
}

function getTransformationByKeyForModel(code: string): Result<TransformationType, DomainError> {
  // We scan transformations to find which one owns this model.
  // Using base120 helpers keeps all logic in the framework layer.
  const possibleKeys: TransformationType[] = ["P", "IN", "CO", "DE", "RE", "SY"];

  for (const key of possibleKeys) {
    const transResult = getTransformationByKey(key);
    if (!transResult.ok) {
      continue;
    }
    const transformation = transResult.value;
    if (transformation.models.some((m) => m.code === code)) {
      return ok(key);
    }
  }

  return err({
    type: "NotFound",
    entity: "Transformation",
    code,
  });
}
