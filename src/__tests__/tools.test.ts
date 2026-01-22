/**
 * Integration tests for MCP tools
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createMockServer } from "./setup.js";
import { registerModelTools } from "../tools/models.js";

describe("MCP Tools Integration", () => {
  let mockServer: any;

  beforeEach(() => {
    mockServer = createMockServer();
    registerModelTools(mockServer);
  });

  describe("Tool Registration", () => {
    it("should register all 8 tools", () => {
      expect(mockServer.tools.size).toBe(8);
    });

    it("should register get_model tool", () => {
      expect(mockServer.getTool("get_model")).toBeDefined();
    });

    it("should register list_all_models tool", () => {
      expect(mockServer.getTool("list_all_models")).toBeDefined();
    });

    it("should register search_models tool", () => {
      expect(mockServer.getTool("search_models")).toBeDefined();
    });

    it("should register recommend_models tool", () => {
      expect(mockServer.getTool("recommend_models")).toBeDefined();
    });

    it("should register get_transformation tool", () => {
      expect(mockServer.getTool("get_transformation")).toBeDefined();
    });

    it("should register search_problem_patterns tool", () => {
      expect(mockServer.getTool("search_problem_patterns")).toBeDefined();
    });
  });

  describe("get_model tool", () => {
    it("should return model for valid code", async () => {
      const tool = mockServer.getTool("get_model");
      const result = await tool.handler({ code: "P1" });

      expect(result.content).toBeDefined();
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent.code).toBe("P1");
      expect(result.structuredContent.name).toBeTruthy();
      expect(result.structuredContent.definition).toBeTruthy();
    });

    it("should handle invalid code", async () => {
      const tool = mockServer.getTool("get_model");
      const result = await tool.handler({ code: "INVALID" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });

    it("should normalize code to uppercase", async () => {
      const tool = mockServer.getTool("get_model");
      const result = await tool.handler({ code: "p1" });

      expect(result.structuredContent.code).toBe("P1");
    });
  });

  describe("list_all_models tool", () => {
    it("should return all 120 models by default", async () => {
      const tool = mockServer.getTool("list_all_models");
      const result = await tool.handler({});

      expect(result.structuredContent.total).toBe(120);
      expect(result.structuredContent.models).toHaveLength(120);
    });

    it("should filter by transformation", async () => {
      const tool = mockServer.getTool("list_all_models");
      const result = await tool.handler({ transformation_filter: "P" });

      expect(result.structuredContent.total).toBe(20);
      expect(result.structuredContent.models).toHaveLength(20);
      expect(result.structuredContent.models.every((m: any) => m.code.startsWith("P"))).toBe(true);
    });

    it("should include transformation info", async () => {
      const tool = mockServer.getTool("list_all_models");
      const result = await tool.handler({});

      result.structuredContent.models.forEach((model: any) => {
        expect(model.transformation).toBeTruthy();
        expect(["P", "IN", "CO", "DE", "RE", "SY"]).toContain(model.transformation);
      });
    });
  });

  describe("search_models tool", () => {
    it("should find models by keyword", async () => {
      const tool = mockServer.getTool("search_models");
      const result = await tool.handler({ query: "principle" });

      expect(result.structuredContent.resultCount).toBeGreaterThan(0);
      expect(result.structuredContent.results.length).toBeGreaterThan(0);
    });

    it("should return query in response", async () => {
      const tool = mockServer.getTool("search_models");
      const result = await tool.handler({ query: "test" });

      expect(result.structuredContent.query).toBe("test");
    });

    it("should handle no results", async () => {
      const tool = mockServer.getTool("search_models");
      const result = await tool.handler({ query: "xyznonexistent123" });

      expect(result.structuredContent.resultCount).toBe(0);
      expect(result.structuredContent.results).toEqual([]);
    });
  });

  describe("recommend_models tool", () => {
    it.skipIf(!process.env.HUMMBL_API_KEY)(
      "should return recommendations for problem",
      async () => {
        const tool = mockServer.getTool("recommend_models");
        const result = await tool.handler({
          problem: "Our startup is growing rapidly but systems are breaking",
        });

        expect(result.structuredContent.recommendationCount).toBeGreaterThan(0);
        expect(result.structuredContent.recommendations.length).toBeGreaterThan(0);
      }
    );

    it.skipIf(!process.env.HUMMBL_API_KEY)("should include problem in response", async () => {
      const problem = "Need to make strategic decision";
      const tool = mockServer.getTool("recommend_models");
      const result = await tool.handler({ problem });

      expect(result.structuredContent.problem).toBe(problem);
    });

    it.skipIf(!process.env.HUMMBL_API_KEY)("should return transformations and models", async () => {
      const tool = mockServer.getTool("recommend_models");
      const result = await tool.handler({ problem: "innovation challenge" });

      const rec = result.structuredContent.recommendations[0];
      expect(rec.transformations).toBeDefined();
      expect(rec.topModels).toBeDefined();
      expect(Array.isArray(rec.transformations)).toBe(true);
      expect(Array.isArray(rec.topModels)).toBe(true);
    });
  });

  describe("get_transformation tool", () => {
    it("should return transformation details", async () => {
      const tool = mockServer.getTool("get_transformation");
      const result = await tool.handler({ key: "P" });

      expect(result.structuredContent.key).toBe("P");
      expect(result.structuredContent.name).toBeTruthy();
      expect(result.structuredContent.description).toBeTruthy();
      expect(result.structuredContent.modelCount).toBe(20);
      expect(result.structuredContent.models).toHaveLength(20);
    });

    it("should handle invalid key", async () => {
      const tool = mockServer.getTool("get_transformation");
      const result = await tool.handler({ key: "INVALID" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });

    it("should work for all transformations", async () => {
      const tool = mockServer.getTool("get_transformation");
      const keys = ["P", "IN", "CO", "DE", "RE", "SY"];

      for (const key of keys) {
        const result = await tool.handler({ key });
        expect(result.structuredContent.key).toBe(key);
        expect(result.structuredContent.modelCount).toBe(20);
      }
    });
  });

  describe("search_problem_patterns tool", () => {
    it("should find problem patterns", async () => {
      const tool = mockServer.getTool("search_problem_patterns");
      const result = await tool.handler({ query: "decision" });

      expect(result.structuredContent.query).toBe("decision");
      expect(result.structuredContent.patternCount).toBeGreaterThanOrEqual(0);
    });

    it("should return empty for no matches", async () => {
      const tool = mockServer.getTool("search_problem_patterns");
      const result = await tool.handler({ query: "xyznonexistent" });

      expect(result.structuredContent.patternCount).toBe(0);
      expect(result.structuredContent.patterns).toEqual([]);
    });

    it("should include transformations and models in patterns", async () => {
      const tool = mockServer.getTool("search_problem_patterns");
      const result = await tool.handler({ query: "growth" });

      if (result.structuredContent.patternCount > 0) {
        const pattern = result.structuredContent.patterns[0];
        expect(pattern.transformations).toBeDefined();
        expect(pattern.topModels).toBeDefined();
        expect(Array.isArray(pattern.transformations)).toBe(true);
        expect(Array.isArray(pattern.topModels)).toBe(true);
      }
    });
  });
});
