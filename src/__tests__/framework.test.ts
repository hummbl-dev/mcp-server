/**
 * Unit tests for HUMMBL framework utilities
 */

import { describe, it, expect } from "vitest";
import {
  getAllModels,
  getModelByCode,
  getTransformationByKey,
  searchModels,
  getModelsByTransformation,
} from "../framework/base120.js";
import { isOk } from "../types/domain.js";

describe("Framework Utilities", () => {
  describe("getAllModels", () => {
    it("should return all 120 models", () => {
      const models = getAllModels();
      expect(models).toHaveLength(120);
    });

    it("should have unique codes", () => {
      const models = getAllModels();
      const codes = models.map((m) => m.code);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(120);
    });

    it("should have all required properties", () => {
      const models = getAllModels();
      models.forEach((model) => {
        expect(model).toHaveProperty("code");
        expect(model).toHaveProperty("name");
        expect(model).toHaveProperty("definition");
        expect(model).toHaveProperty("priority");
        expect(typeof model.code).toBe("string");
        expect(typeof model.name).toBe("string");
        expect(typeof model.definition).toBe("string");
        expect(typeof model.priority).toBe("number");
      });
    });
  });

  describe("getModelByCode", () => {
    it("should return model for valid code", () => {
      const result = getModelByCode("P1");
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.code).toBe("P1");
      }
    });

    it("should return error for invalid code", () => {
      const result = getModelByCode("INVALID");
      expect(isOk(result)).toBe(false);
    });

    it("should be case-insensitive", () => {
      const upper = getModelByCode("P1");
      const lower = getModelByCode("p1");
      expect(isOk(upper)).toBe(true);
      expect(isOk(lower)).toBe(true);
      if (isOk(upper) && isOk(lower)) {
        expect(upper.value.code).toBe(lower.value.code);
      }
    });

    it("should handle all transformation prefixes", () => {
      const prefixes = ["P", "IN", "CO", "DE", "RE", "SY"];
      prefixes.forEach((prefix) => {
        const result = getModelByCode(`${prefix}1`);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.code).toMatch(new RegExp(`^${prefix}\\d+$`));
        }
      });
    });
  });

  describe("getTransformationByKey", () => {
    it("should return transformation for valid key", () => {
      const result = getTransformationByKey("P" as any);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.key).toBe("P");
        expect(result.value.models.length).toBeGreaterThan(0);
      }
    });

    it("should return error for invalid key", () => {
      const result = getTransformationByKey("INVALID" as any);
      expect(isOk(result)).toBe(false);
    });

    it("should return all 6 transformations", () => {
      const keys = ["P", "IN", "CO", "DE", "RE", "SY"];
      keys.forEach((key) => {
        const result = getTransformationByKey(key as any);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.key).toBe(key);
        }
      });
    });

    it("should have 20 models per transformation", () => {
      const keys = ["P", "IN", "CO", "DE", "RE", "SY"];
      keys.forEach((key) => {
        const result = getTransformationByKey(key as any);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.models.length).toBe(20);
        }
      });
    });
  });

  describe("searchModels", () => {
    it("should find models by name", () => {
      const result = searchModels("principle");
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const results = result.value;
        expect(results.length).toBeGreaterThan(0);
        expect(results.some((m) => m.name.toLowerCase().includes("principle"))).toBe(true);
      }
    });

    it("should find models by definition", () => {
      const result = searchModels("fundamental");
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const results = result.value;
        expect(results.length).toBeGreaterThan(0);
        expect(results.some((m) => m.definition.toLowerCase().includes("fundamental"))).toBe(true);
      }
    });

    it("should find models by code", () => {
      const result = searchModels("P1");
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const results = result.value;
        expect(results.length).toBeGreaterThan(0);
        expect(results.some((m) => m.code === "P1")).toBe(true);
      }
    });

    it("should be case-insensitive", () => {
      const upper = searchModels("PRINCIPLE");
      const lower = searchModels("principle");
      expect(isOk(upper)).toBe(true);
      expect(isOk(lower)).toBe(true);
      if (isOk(upper) && isOk(lower)) {
        expect(upper.value.length).toBe(lower.value.length);
      }
    });

    it("should return empty array for no matches", () => {
      const result = searchModels("xyznonexistent123");
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([]);
      }
    });
  });

  describe("getModelsByTransformation", () => {
    it("should return models for valid transformation", () => {
      const result = getModelsByTransformation("P" as any);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const models = result.value;
        expect(models.length).toBe(20);
        expect(models.every((m) => m.code.startsWith("P"))).toBe(true);
      }
    });

    it("should return error for invalid transformation", () => {
      const result = getModelsByTransformation("INVALID" as any);
      expect(isOk(result)).toBe(false);
    });

    it("should work for all transformations", () => {
      const keys = ["P", "IN", "CO", "DE", "RE", "SY"];
      keys.forEach((key) => {
        const result = getModelsByTransformation(key as any);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.length).toBe(20);
        }
      });
    });
  });
});
