import { describe, expect, it } from "vitest";

import { auditModelCodes, getSelfDialecticalMethodology } from "../framework/self_dialectical.js";
import { isOk } from "../types/domain.js";

describe("Self-Dialectical Methodology", () => {
  describe("getSelfDialecticalMethodology", () => {
    it("returns canonical methodology payload with ordered stages", () => {
      const result = getSelfDialecticalMethodology();
      expect(isOk(result)).toBe(true);

      if (!isOk(result)) {
        return;
      }

      const methodology = result.value;
      expect(methodology.id).toBe("self_dialectical_ai_v1_2");
      expect(methodology.version).toBe("1.2");

      const expectedStageOrder = [
        "thesis",
        "antithesis",
        "synthesis",
        "convergence",
        "meta_reflection",
      ];
      const actualStageOrder = methodology.stages.map((stage) => stage.stage);
      expect(actualStageOrder).toEqual(expectedStageOrder);

      const stageModelCount = methodology.stages.reduce(
        (total, stage) => total + stage.modelCodes.length,
        0
      );
      expect(stageModelCount).toBeGreaterThan(0);

      const flattenedStageModels = new Set(methodology.stages.flatMap((stage) => stage.modelCodes));
      const referencedCoverage = new Set([...flattenedStageModels, ...methodology.metaModels]);

      methodology.modelsReferenced.forEach((code) => {
        expect(referencedCoverage.has(code)).toBe(true);
      });

      expect(methodology.metaModels).toEqual(["SY19", "SY1"]);
    });
  });

  describe("auditModelCodes", () => {
    it("returns ValidationError when no items are provided", () => {
      const result = auditModelCodes([]);
      expect(isOk(result)).toBe(false);
      if (isOk(result)) {
        return;
      }

      expect(result.error.type).toBe("ValidationError");
      if (result.error.type === "ValidationError") {
        expect(result.error.field).toBe("codes");
      }
    });

    it("flags invalid, duplicate, and wrong transformation references", () => {
      const result = auditModelCodes([
        { code: "P1" },
        { code: "p1" },
        { code: "IN11", expectedTransformation: "CO" },
        { code: "ZZ99" },
      ]);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) {
        return;
      }

      const payload = result.value;
      expect(payload.totalReferences).toBe(4);
      expect(payload.validCount).toBe(3);
      expect(payload.invalidCount).toBe(payload.issues.length);

      expect(
        payload.issues.some((issue) => issue.code === "P1" && issue.issueType === "Duplicate")
      ).toBe(true);

      expect(
        payload.issues.some(
          (issue) =>
            issue.code === "IN11" &&
            issue.issueType === "WrongTransformation" &&
            issue.expectedTransformation === "CO" &&
            issue.actualTransformation === "IN"
        )
      ).toBe(true);

      expect(
        payload.issues.some((issue) => issue.code === "ZZ99" && issue.issueType === "NotFound")
      ).toBe(true);
    });
  });
});
