/**
 * HUMMBL Mental Models Tools
 * MCP tool registrations for Base120 framework operations
 * Hybrid architecture: Local data for fast lookups, REST API for recommendations
 */

/* eslint-disable no-undef */
// fetch is a global in Cloudflare Workers environment

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  TRANSFORMATIONS,
  getAllModels,
  getModelByCode,
  searchModels,
  getModelsByTransformation,
} from "../framework/base120.js";
import { isOk } from "../types/domain.js";
import { MCP_CONFIG } from "../config/mcp.js";

// REST API Configuration (from centralized config)
const API_CONFIG = {
  baseUrl: MCP_CONFIG.HUMMBL_API_URL,
  apiKey: MCP_CONFIG.HUMMBL_API_KEY,
} as const;

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
      const result = getModelByCode(normalizedCode);

      if (!isOk(result)) {
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

      const model = result.value;

      const transformation = Object.values(TRANSFORMATIONS).find((t) =>
        t.models.some((m) => m.code === model.code)
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
    }
  );

  // Tool: List all models
  server.registerTool(
    "list_all_models",
    {
      title: "List All Mental Models",
      description: "Retrieve complete list of all 120 HUMMBL mental models with basic information.",
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
          })
        ),
      }),
    },
    async ({ transformation_filter }) => {
      let models = getAllModels();

      if (transformation_filter) {
        const result = getModelsByTransformation(transformation_filter);
        if (!isOk(result)) {
          return {
            content: [
              {
                type: "text",
                text: `Unable to list models for transformation '${transformation_filter}'.`,
              },
            ],
            isError: true,
          } as const;
        }
        models = result.value;
      }

      const enriched = models.map((m) => {
        const trans = Object.values(TRANSFORMATIONS).find((t) =>
          t.models.some((model) => model.code === m.code)
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
    }
  );

  // Tool: Search models
  server.registerTool(
    "search_models",
    {
      title: "Search Mental Models",
      description: "Search HUMMBL mental models by keyword across codes, names, and definitions.",
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
          })
        ),
      }),
    },
    async ({ query }) => {
      const result = searchModels(query);

      if (!isOk(result)) {
        return {
          content: [
            {
              type: "text",
              text: `Unable to search models: ${result.error.type}`,
            },
          ],
          isError: true,
        } as const;
      }

      const enriched = result.value.map((m) => {
        const trans = Object.values(TRANSFORMATIONS).find((t) =>
          t.models.some((model) => model.code === m.code)
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
    }
  );

  // Tool: Recommend models based on problem description (USES REST API)
  server.registerTool(
    "recommend_models",
    {
      title: "Recommend Models for Problem",
      description:
        "Get recommended mental models based on a natural language problem description using HUMMBL REST API.",
      inputSchema: z.object({
        problem: z.string().min(10).describe("Detailed description of the problem or challenge"),
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
              })
            ),
            topModels: z.array(
              z.object({
                code: z.string(),
                name: z.string(),
                definition: z.string(),
                priority: z.number(),
              })
            ),
          })
        ),
      }),
    },
    async ({ problem }) => {
      try {
        if (!API_CONFIG.apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "HUMMBL API key not configured. Please set HUMMBL_API_KEY environment variable.",
              },
            ],
            isError: true,
            structuredContent: undefined,
          } as const;
        }

        const response = await fetch(`${API_CONFIG.baseUrl}/v1/recommend`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${API_CONFIG.apiKey}`,
          },
          body: JSON.stringify({ problem }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return {
            content: [
              {
                type: "text",
                text: `API request failed: ${response.status} ${response.statusText}\n${errorText}`,
              },
            ],
            isError: true,
            structuredContent: undefined,
          } as const;
        }

        const payload = await response.json();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(payload, null, 2),
            },
          ],
          structuredContent: payload as {
            problem: string;
            recommendationCount: number;
            recommendations: Array<{
              pattern: string;
              transformations: Array<{
                key: string;
                name: string;
                description: string;
              }>;
              topModels: Array<{
                code: string;
                name: string;
                definition: string;
                priority: number;
              }>;
            }>;
          },
        } as const;
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to call HUMMBL API: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
          structuredContent: undefined,
        } as const;
      }
    }
  );

  // Tool: Get model relationships
  /*
  server.registerTool(
    "get_model_relationships",
    {
      title: "Get Model Relationships",
      description: "Get all relationships involving a specific mental model, showing how it connects to other models.",
      inputSchema: z.object({
        code: z
          .string()
          .regex(/^(P|IN|CO|DE|RE|SY)\d{1,2}$/i)
          .describe("Model code (e.g., DE1, P5, IN2)"),
      }),
      outputSchema: z.object({
        model: z.string(),
        relationships: z.array(
          z.object({
            related_model: z.string(),
            type: z.string(),
            direction: z.string(),
            confidence: z.string(),
            logical_derivation: z.string(),
            relationship_id: z.string(),
          })
        ),
      }),
    },
    async ({ code }) => {
      try {
        const response = await fetch(`${API_CONFIG.baseUrl}/v1/models/${code.toUpperCase()}/relationships`, {
          headers: {
            "Authorization": `Bearer ${API_CONFIG.apiKey}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          return {
            content: [
              {
                type: "text",
                text: `API request failed: ${response.status} ${response.statusText}\n${errorText}`,
              },
            ],
            isError: true,
          };
        }

        const payload = (await response.json()) as Record<string, unknown>;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(payload, null, 2),
            },
          ],
          structuredContent: payload,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to call HUMMBL API: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
  */

  // Tool: Find relationship path between models
  /*
  server.registerTool(
    "find_relationship_path",
    {
      title: "Find Relationship Path",
      description: "Find reasoning chains and relationships between two models.",
      inputSchema: z.object({
        from: z
          .string()
          .regex(/^(P|IN|CO|DE|RE|SY)\d{1,2}$/i)
          .describe("Starting model code"),
        to: z
          .string()
          .regex(/^(P|IN|CO|DE|RE|SY)\d{1,2}$/i)
          .describe("Target model code"),
        max_depth: z.number().min(1).max(5).default(3).describe("Maximum relationship depth"),
      }),
      outputSchema: z.object({
        from: z.string(),
        to: z.string(),
        paths: z.array(
          z.object({
            path: z.array(z.string()),
            relationships: z.array(
              z.object({
                from: z.string(),
                to: z.string(),
                type: z.string(),
                confidence: z.string(),
                logical_derivation: z.string(),
              })
            ),
            confidence_score: z.number(),
          })
        ),
        total_paths: z.number(),
      }),
    },
    async ({ from, to, max_depth = 3 }) => {
      try {
        // Get relationships for both models
        const [fromResponse, toResponse] = await Promise.all([
          fetch(`${API_CONFIG.baseUrl}/v1/models/${from.toUpperCase()}/relationships`, {
            headers: { "Authorization": `Bearer ${API_CONFIG.apiKey}` },
          }),
          fetch(`${API_CONFIG.baseUrl}/v1/models/${to.toUpperCase()}/relationships`, {
            headers: { "Authorization": `Bearer ${API_CONFIG.apiKey}` },
          }),
        ]);

        if (!fromResponse.ok || !toResponse.ok) {
          return {
            content: [
              {
                type: "text",
                text: "Failed to retrieve relationship data for path finding",
              },
            ],
            isError: true,
          } as const;
        }

        const fromData = await fromResponse.json() as { relationships?: any[] };
        const toData = await toResponse.json() as { relationships?: any[] };

        // Simple path finding - look for direct connections and 1-hop paths
        const paths: any[] = [];
        const fromRels = fromData.relationships || [];
        const toRels = toData.relationships || [];

        // Direct connections
        const directConnections = fromRels.filter((rel: any) =>
          rel.related_model === to.toUpperCase()
        );

        if (directConnections.length > 0) {
          paths.push({
            path: [from.toUpperCase(), to.toUpperCase()],
            relationships: directConnections.map((rel: any) => ({
              from: from.toUpperCase(),
              to: rel.related_model,
              type: rel.type,
              confidence: rel.confidence,
              logical_derivation: rel.logical_derivation,
            })),
            confidence_score: Math.max(...directConnections.map((r: any) =>
              r.confidence === 'A' ? 3 : r.confidence === 'B' ? 2 : 1
            )),
          });
        }

        // 1-hop paths (common related models)
        const fromRelated = new Set(fromRels.map((r: any) => r.related_model));
        const toRelated = new Set(toRels.map((r: any) => r.related_model));
        const commonRelated = [...fromRelated].filter(model => toRelated.has(model));

        for (const intermediate of commonRelated.slice(0, 5)) { // Limit to 5 paths
          const fromToIntermediate = fromRels.find((r: any) => r.related_model === intermediate);
          const intermediateToTo = toRels.find((r: any) => r.related_model === intermediate);

          if (fromToIntermediate && intermediateToTo) {
            paths.push({
              path: [from.toUpperCase(), intermediate, to.toUpperCase()],
              relationships: [
                {
                  from: from.toUpperCase(),
                  to: intermediate,
                  type: fromToIntermediate.type,
                  confidence: fromToIntermediate.confidence,
                  logical_derivation: fromToIntermediate.logical_derivation,
                },
                {
                  from: intermediate,
                  to: to.toUpperCase(),
                  type: intermediateToTo.type,
                  confidence: intermediateToTo.confidence,
                  logical_derivation: intermediateToTo.logical_derivation,
                }
              ],
              confidence_score: Math.min(
                fromToIntermediate.confidence === 'A' ? 3 : fromToIntermediate.confidence === 'B' ? 2 : 1,
                intermediateToTo.confidence === 'A' ? 3 : intermediateToTo.confidence === 'B' ? 2 : 1
              ),
            });
          }
        }

        const payload = {
          from: from.toUpperCase(),
          to: to.toUpperCase(),
          paths: paths.slice(0, 10), // Limit to top 10 paths
          total_paths: paths.length,
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
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to find relationship paths: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        } as const;
      }
    }
  );
  */

  // Tool: Get relationship neighborhood
  /*
  server.registerTool(
    "get_relationship_neighborhood",
    {
      title: "Get Relationship Neighborhood",
      description: "Get models within N relationships of a given model to understand its context in the knowledge graph.",
      inputSchema: z.object({
        code: z
          .string()
          .regex(/^(P|IN|CO|DE|RE|SY)\d{1,2}$/i)
          .describe("Center model code"),
        depth: z.number().min(1).max(3).default(2).describe("Relationship depth"),
        confidence_min: z.enum(["C", "B", "A"]).default("C").describe("Minimum confidence level"),
      }),
      outputSchema: z.object({
        center_model: z.string(),
        neighborhood: z.array(
          z.object({
            model: z.string(),
            distance: z.number(),
            paths: z.array(
              z.object({
                path: z.array(z.string()),
                relationship: z.object({
                  type: z.string(),
                  confidence: z.string(),
                  logical_derivation: z.string(),
                }),
              })
            ),
          })
        ),
        total_models: z.number(),
        depth: z.number(),
      }),
    },
    async ({ code, depth = 2, confidence_min = "C" }) => {
      try {
        const response = await fetch(
          `${API_CONFIG.baseUrl}/v1/relationships?model=${code.toUpperCase()}&confidence=${confidence_min}&status=confirmed`,
          {
            headers: { "Authorization": `Bearer ${API_CONFIG.apiKey}` },
          }
        );

        if (!response.ok) {
          return {
            content: [
              {
                type: "text",
                text: `API request failed: ${response.status} ${response.statusText}`,
              },
            ],
            isError: true,
          } as const;
        }

        const data = await response.json() as { relationships?: any[] };
        const relationships = data.relationships || [];

        // Build neighborhood
        const visited = new Set<string>([code.toUpperCase()]);
        const neighborhood: any[] = [];

        // Direct connections (depth 1)
        const directConnections = new Map<string, any[]>();

        relationships.forEach((rel: any) => {
          const otherModel = rel.model_a === code.toUpperCase() ? rel.model_b : rel.model_a;
          if (!directConnections.has(otherModel)) {
            directConnections.set(otherModel, []);
          }
          directConnections.get(otherModel)!.push({
            path: [code.toUpperCase(), otherModel],
            relationship: {
              type: rel.relationship_type,
              confidence: rel.confidence,
              logical_derivation: rel.logical_derivation,
            },
          });
        });

        // Add direct connections to neighborhood
        for (const [model, paths] of directConnections) {
          neighborhood.push({
            model,
            distance: 1,
            paths,
          });
          visited.add(model);
        }

        // For depth > 1, we would need more complex graph traversal
        // For now, just return direct connections

        const payload = {
          center_model: code.toUpperCase(),
          neighborhood,
          total_models: neighborhood.length,
          depth,
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
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get relationship neighborhood: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        } as const;
      }
    }
  );
  */

  // Tool: Get related models
  server.registerTool(
    "get_related_models",
    {
      title: "Get Related Mental Models",
      description: "Get all models related to a specific model with relationship details",
      inputSchema: z.object({
        code: z.string().describe("Model code (e.g., P1, DE7)"),
      }),
    },
    async ({ code }) => {
      try {
        const response = await fetch(
          `${API_CONFIG.baseUrl}/v1/models/${code.toUpperCase()}/relationships`,
          {
            headers: {
              Authorization: `Bearer ${API_CONFIG.apiKey}`,
            },
          }
        );

        if (!response.ok) {
          return {
            content: [
              {
                type: "text",
                text: `API request failed: ${response.status} ${response.statusText}`,
              },
            ],
            isError: true,
          };
        }

        const payload = (await response.json()) as Record<string, unknown>;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(payload, null, 2),
            },
          ],
          structuredContent: payload,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get related models: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Find relationship path (BFS)
  /*
  server.registerTool(
    "find_relationship_path",
    {
      title: "Find Relationship Path",
      description: "Find the shortest path of relationships between two models",
      inputSchema: z.object({
        from: z.string().describe("Source model code"),
        to: z.string().describe("Target model code"),
        maxDepth: z.number().optional().default(5)
      })
    },
    async ({ from, to, maxDepth = 5 }) => {
      try {
        // Get all relationships
        const response = await fetch(`${API_CONFIG.baseUrl}/v1/relationships?limit=1000`, {
          headers: {
            "Authorization": `Bearer ${API_CONFIG.apiKey}`,
          },
        });

        if (!response.ok) {
          return {
            content: [
              {
                type: "text",
                text: `API request failed: ${response.status} ${response.statusText}`,
              },
            ],
            isError: true,
          };
        }

        const data = await response.json();
        const relationships = data.relationships || [];

        // Build adjacency list
        const graph: Record<string, Array<{ target: string; type: string; confidence: string }>> = {};

        relationships.forEach((rel: any) => {
          const source = rel.model_a;
          const target = rel.model_b;
          const type = rel.relationship_type;
          const confidence = rel.confidence;

          if (!graph[source]) graph[source] = [];
          if (!graph[target]) graph[target] = [];

          graph[source].push({ target, type, confidence });
          // Add reverse for bidirectional search
          graph[target].push({ target: source, type: `${type} (reverse)`, confidence });
        });

        // BFS to find shortest path
        const queue: Array<{
          node: string;
          path: string[];
          relationships: Array<{ from: string; to: string; type: string; confidence: string }>;
          depth: number;
        }> = [{ node: from.toUpperCase(), path: [from.toUpperCase()], relationships: [], depth: 0 }];

        const visited = new Set<string>();
        visited.add(from.toUpperCase());

        while (queue.length > 0) {
          const current = queue.shift()!;
          if (current.depth > maxDepth) continue;

          if (current.node === to.toUpperCase()) {
            // Found path
            const payload = {
              from: from.toUpperCase(),
              to: to.toUpperCase(),
              path: current.path,
              relationships: current.relationships,
              path_length: current.path.length - 1,
              confidence_score: Math.min(...current.relationships.map(r =>
                r.confidence === 'A' ? 3 : r.confidence === 'B' ? 2 : 1
              )),
            };

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(payload, null, 2),
                },
              ],
              structuredContent: payload,
            };
          }

          if (graph[current.node]) {
            for (const neighbor of graph[current.node]) {
              if (!visited.has(neighbor.target)) {
                visited.add(neighbor.target);
                queue.push({
                  node: neighbor.target,
                  path: [...current.path, neighbor.target],
                  relationships: [...current.relationships, {
                    from: current.node,
                    to: neighbor.target,
                    type: neighbor.type,
                    confidence: neighbor.confidence,
                  }],
                  depth: current.depth + 1,
                });
              }
            }
          }
        }

        // No path found
        return {
          content: [
            {
              type: "text",
              text: `No relationship path found between ${from} and ${to} within ${maxDepth} steps`,
            },
          ],
          structuredContent: {
            from: from.toUpperCase(),
            to: to.toUpperCase(),
            path: null,
            relationships: [],
            message: "No path found",
          },
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to find relationship path: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
  */

  // Tool: Add relationship
  server.registerTool(
    "add_relationship",
    {
      title: "Add Model Relationship",
      description: "Add a relationship between two mental models with evidence.",
      inputSchema: z.object({
        source_code: z
          .string()
          .regex(/^(P|IN|CO|DE|RE|SY)\d{1,2}$/i)
          .describe("Source model code"),
        target_code: z
          .string()
          .regex(/^(P|IN|CO|DE|RE|SY)\d{1,2}$/i)
          .describe("Target model code"),
        relationship_type: z
          .string()
          .describe("Type of relationship (e.g., 'enables', 'reinforces')"),
        confidence: z
          .enum(["A", "B", "C"])
          .describe("Confidence level: A=High, B=Moderate, C=Hypothesis"),
        evidence: z.string().optional().describe("Evidence supporting this relationship"),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        relationship: z.object({
          source_code: z.string(),
          target_code: z.string(),
          relationship_type: z.string(),
          confidence: z.string(),
          evidence: z.string().optional(),
        }),
      }),
    },
    async ({ source_code, target_code, relationship_type, confidence, evidence }) => {
      try {
        const response = await fetch(`${API_CONFIG.baseUrl}/v1/relationships`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${API_CONFIG.apiKey}`,
          },
          body: JSON.stringify({
            source_code,
            target_code,
            relationship_type,
            confidence,
            evidence,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return {
            content: [
              {
                type: "text",
                text: `API request failed: ${response.status} ${response.statusText}\n${errorText}`,
              },
            ],
            isError: true,
          };
        }

        const payload = (await response.json()) as Record<string, unknown>;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(payload, null, 2),
            },
          ],
          structuredContent: payload,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to add relationship: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
