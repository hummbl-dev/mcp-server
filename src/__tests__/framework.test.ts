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
      const model = getModelByCode("P1");
      expect(model).toBeDefined();
      expect(model?.code).toBe("P1");
    });

    it("should return null for invalid code", () => {
      const model = getModelByCode("INVALID");
      expect(model).toBeNull();
    });

    it("should be case-insensitive", () => {
      const upper = getModelByCode("P1");
      const lower = getModelByCode("p1");
      expect(upper?.code).toBe(lower?.code);
    });

    it("should handle all transformation prefixes", () => {
      const prefixes = ["P", "IN", "CO", "DE", "RE", "SY"];
      prefixes.forEach((prefix) => {
        const model = getModelByCode(`${prefix}1`);
        expect(model).toBeDefined();
        expect(model?.code).toMatch(new RegExp(`^${prefix}\\d+$`));
      });
    });
  });

  describe("getTransformationByKey", () => {
    it("should return transformation for valid key", () => {
      const transformation = getTransformationByKey("P");
      expect(transformation).toBeDefined();
      expect(transformation?.key).toBe("P");
      expect(transformation?.models.length).toBeGreaterThan(0);
    });

    it("should return null for invalid key", () => {
      const transformation = getTransformationByKey("INVALID" as any);
      expect(transformation).toBeNull();
    });

    it("should return all 6 transformations", () => {
      const keys = ["P", "IN", "CO", "DE", "RE", "SY"];
      keys.forEach((key) => {
        const transformation = getTransformationByKey(key as any);
        expect(transformation).toBeDefined();
        expect(transformation?.key).toBe(key);
      });
    });

    it("should have 20 models per transformation", () => {
      const keys = ["P", "IN", "CO", "DE", "RE", "SY"];
      keys.forEach((key) => {
        const transformation = getTransformationByKey(key as any);
        expect(transformation?.models.length).toBe(20);
      });
    });
  });

  describe("searchModels", () => {
    it("should find models by name", () => {
      const results = searchModels("principle");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((m) => m.name.toLowerCase().includes("principle"))).toBe(true);
    });

    it("should find models by definition", () => {
      const results = searchModels("fundamental");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((m) => m.definition.toLowerCase().includes("fundamental"))).toBe(true);
    });

    it("should find models by code", () => {
      const results = searchModels("P1");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((m) => m.code === "P1")).toBe(true);
    });

    it("should be case-insensitive", () => {
      const upper = searchModels("PRINCIPLE");
      const lower = searchModels("principle");
      expect(upper.length).toBe(lower.length);
    });

    it("should return empty array for no matches", () => {
      const results = searchModels("xyznonexistent123");
      expect(results).toEqual([]);
    });
  });

  describe("getModelsByTransformation", () => {
    it("should return models for valid transformation", () => {
      const models = getModelsByTransformation("P");
      expect(models.length).toBe(20);
      expect(models.every((m) => m.code.startsWith("P"))).toBe(true);
    });

    it("should return empty array for invalid transformation", () => {
      const models = getModelsByTransformation("INVALID" as any);
      expect(models).toEqual([]);
    });

    it("should work for all transformations", () => {
      const keys = ["P", "IN", "CO", "DE", "RE", "SY"];
      keys.forEach((key) => {
        const models = getModelsByTransformation(key as any);
        expect(models.length).toBe(20);
      });
    });
  });
});
