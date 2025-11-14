/**
 * HUMMBL Mental Models Tools
 * MCP tool registrations for Base120 framework operations
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  TRANSFORMATIONS,
  PROBLEM_PATTERNS,
  getAllModels,
  getModelByCode,
  getTransformationByKey,
  searchModels,
  getModelsByTransformation,
} from "../framework/base120.js";

/**
 * Register all model-related tools with the MCP server.
 */
export function registerModelTools(server: McpServer): void {
  // Tool: Get specific model by code
  server.registerTool(
    "get_model",
    {
      title: "Get Mental Model by Code",
      description:
        "Retrieve detailed information about a specific HUMMBL mental model using its code (e.g., P1, IN3, CO5).",
      inputSchema: z.object({
        code: z
          .string()
          .regex(/^(P|IN|CO|DE|RE|SY)\d{1,2}$/i)
          .describe("Model code (e.g., P1, IN3, CO5)"),
      }),
      outputSchema: z.object({
        code: z.string(),
        name: z.string(),
        definition: z.string(),
        priority: z.number(),
        transformation: z.string().nullable(),
      }),
    },
    async ({ code }) => {
      const normalizedCode = code.toUpperCase();
      const model = getModelByCode(normalizedCode);

      if (!model) {
        return {
          content: [
            {
              type: "text",
              text: `Model code '${code}' not found in HUMMBL Base120 framework. Valid codes follow the pattern [P|IN|CO|DE|RE|SY][1-20].`,
            },
          ],
          isError: true,
        } as const;
      }

      const transformation = Object.values(TRANSFORMATIONS).find((t) =>
        t.models.some((m) => m.code === model.code),
      );

      const payload = {
        code: model.code,
        name: model.name,
        definition: model.definition,
        priority: model.priority,
        transformation: transformation?.key ?? null,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ model: payload }, null, 2),
          },
        ],
        structuredContent: payload,
      } as const;
    },
  );

  // Tool: List all models
  server.registerTool(
    "list_all_models",
    {
      title: "List All Mental Models",
      description:
        "Retrieve complete list of all 120 HUMMBL mental models with basic information.",
      inputSchema: z.object({
        transformation_filter: z
          .enum(["P", "IN", "CO", "DE", "RE", "SY"])
          .optional()
          .describe("Optional filter by transformation type"),
      }),
      outputSchema: z.object({
        total: z.number(),
        models: z.array(
          z.object({
            code: z.string(),
            name: z.string(),
            definition: z.string(),
            priority: z.number(),
            transformation: z.string(),
          }),
        ),
      }),
    },
    async ({ transformation_filter }) => {
      let models = getAllModels();

      if (transformation_filter) {
        models = getModelsByTransformation(transformation_filter);
      }

      const enriched = models.map((m) => {
        const trans = Object.values(TRANSFORMATIONS).find((t) =>
          t.models.some((model) => model.code === m.code),
        );

        return {
          code: m.code,
          name: m.name,
          definition: m.definition,
          priority: m.priority,
          transformation: trans?.key ?? "UNKNOWN",
        };
      });

      const payload = {
        total: enriched.length,
        models: enriched,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
        structuredContent: payload,
      } as const;
    },
  );

  // Tool: Search models
  server.registerTool(
    "search_models",
    {
      title: "Search Mental Models",
      description:
        "Search HUMMBL mental models by keyword across codes, names, and definitions.",
      inputSchema: z.object({
        query: z.string().min(2).describe("Search query (minimum 2 characters)"),
      }),
      outputSchema: z.object({
        query: z.string(),
        resultCount: z.number(),
        results: z.array(
          z.object({
            code: z.string(),
            name: z.string(),
            definition: z.string(),
            priority: z.number(),
            transformation: z.string(),
          }),
        ),
      }),
    },
    async ({ query }) => {
      const results = searchModels(query);

      const enriched = results.map((m) => {
        const trans = Object.values(TRANSFORMATIONS).find((t) =>
          t.models.some((model) => model.code === m.code),
        );
        return {
          code: m.code,
          name: m.name,
          definition: m.definition,
          priority: m.priority,
          transformation: trans?.key ?? "UNKNOWN",
        };
      });

      const payload = {
        query,
        resultCount: enriched.length,
        results: enriched,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
        structuredContent: payload,
      } as const;
    },
  );

  // Tool: Recommend models based on problem description
  server.registerTool(
    "recommend_models",
    {
      title: "Recommend Models for Problem",
      description:
        "Get recommended mental models based on a natural language problem description.",
      inputSchema: z.object({
        problem: z
          .string()
          .min(10)
          .describe("Detailed description of the problem or challenge"),
      }),
      outputSchema: z.object({
        problem: z.string(),
        recommendationCount: z.number(),
        recommendations: z.array(
          z.object({
            pattern: z.string(),
            transformations: z.array(
              z.object({
                key: z.string(),
                name: z.string(),
                description: z.string(),
              }),
            ),
            topModels: z.array(
              z.object({
                code: z.string(),
                name: z.string(),
                definition: z.string(),
                priority: z.number(),
              }),
            ),
          }),
        ),
      }),
    },
    async ({ problem }) => {
      const problemLower = problem.toLowerCase();

      const matchedPatterns = PROBLEM_PATTERNS.filter((p) => {
        const patternWords = p.pattern.toLowerCase().split(" ");
        return patternWords.some((word) => problemLower.includes(word));
      });

      const recommendations =
        matchedPatterns.length > 0 ? matchedPatterns : PROBLEM_PATTERNS;

      const enrichedRecommendations = recommendations.map((rec) => ({
        pattern: rec.pattern,
        transformations: rec.transformations.map((tKey) => {
          const t = TRANSFORMATIONS[tKey];
          return {
            key: t.key,
            name: t.name,
            description: t.description,
          };
        }),
        topModels: rec.topModels
          .map((code) => {
            const model = getModelByCode(code);
            return model
              ? {
                  code: model.code,
                  name: model.name,
                  definition: model.definition,
                  priority: model.priority,
                }
              : null;
          })
          .filter((m): m is NonNullable<typeof m> => m !== null),
      }));

      const payload = {
        problem,
        recommendationCount: enrichedRecommendations.length,
        recommendations: enrichedRecommendations,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
        structuredContent: payload,
      } as const;
    },
  );

  // Tool: Get transformation details
  server.registerTool(
    "get_transformation",
    {
      title: "Get Transformation Details",
      description:
        "Retrieve detailed information about a specific transformation and its models.",
      inputSchema: z.object({
        key: z
          .enum(["P", "IN", "CO", "DE", "RE", "SY"])
          .describe("Transformation key"),
      }),
      outputSchema: z.object({
        key: z.string(),
        name: z.string(),
        description: z.string(),
        modelCount: z.number(),
        models: z.array(
          z.object({
            code: z.string(),
            name: z.string(),
            definition: z.string(),
            priority: z.number(),
          }),
        ),
      }),
    },
    async ({ key }) => {
      const transformation = getTransformationByKey(key);

      if (!transformation) {
        return {
          content: [
            {
              type: "text",
              text: `Transformation '${key}' not found. Valid transformations are: P, IN, CO, DE, RE, SY.`,
            },
          ],
          isError: true,
        } as const;
      }

      const payload = {
        key: transformation.key,
        name: transformation.name,
        description: transformation.description,
        modelCount: transformation.models.length,
        models: transformation.models,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
        structuredContent: payload,
      } as const;
    },
  );

  // Tool: Search predefined problem patterns
  server.registerTool(
    "search_problem_patterns",
    {
      title: "Search Problem Patterns",
      description:
        "Find predefined HUMMBL problem patterns with recommended transformations and top models.",
      inputSchema: z.object({
        query: z
          .string()
          .min(3)
          .describe("Problem pattern keyword or description"),
      }),
      outputSchema: z.object({
        query: z.string(),
        patternCount: z.number(),
        patterns: z.array(
          z.object({
            pattern: z.string(),
            transformations: z.array(z.string()),
            topModels: z.array(z.string()),
          }),
        ),
      }),
    },
    async ({ query }) => {
      const lower = query.toLowerCase();
      const patterns = PROBLEM_PATTERNS.filter((p) =>
        p.pattern.toLowerCase().includes(lower),
      );

      const payload = {
        query,
        patternCount: patterns.length,
        patterns,
      };

      if (patterns.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No problem patterns found matching "${query}"`,
            },
          ],
          structuredContent: payload,
        } as const;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
        structuredContent: payload,
      } as const;
    },
  );
}
