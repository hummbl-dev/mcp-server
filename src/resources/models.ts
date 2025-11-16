/**
 * HUMMBL Resources
 * MCP resources for direct URI-based access to models and transformations
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getAllModels, getModelByCode, getTransformationByKey } from "../framework/base120.js";

/**
 * Register HUMMBL resources with the MCP server.
 */
export function registerModelResources(server: McpServer): void {
  // Resource: Individual model by code
  server.registerResource(
    "model-by-code",
    new ResourceTemplate("hummbl://model/{code}", { list: undefined }),
    {
      title: "HUMMBL Mental Model",
      description: "Access individual mental model by code (e.g., hummbl://model/P1)",
      mimeType: "application/json",
    },
    async (uri: URL, variables: Record<string, string | string[]>) => {
      const rawCode = variables.code;
      const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;
      const normalizedCode = code.toUpperCase();
      const model = getModelByCode(normalizedCode);

      if (!model) {
        throw new Error(
          `Model code '${code}' not found. Use valid HUMMBL Base120 codes like P1, IN3, CO5.`
        );
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(model, null, 2),
          },
        ],
      };
    }
  );

  // Resource: All models in a transformation
  server.registerResource(
    "transformation-models",
    new ResourceTemplate("hummbl://transformation/{type}", { list: undefined }),
    {
      title: "HUMMBL Transformation Models",
      description: "Access all models in a transformation (e.g., hummbl://transformation/P)",
      mimeType: "application/json",
    },
    async (uri: URL, variables: Record<string, string | string[]>) => {
      const rawType = variables.type;
      const type = Array.isArray(rawType) ? rawType[0] : rawType;
      const upperType = type.toUpperCase();
      const transformation = getTransformationByKey(upperType);

      if (!transformation) {
        throw new Error(
          `Transformation '${type}' not found. Valid transformations are: P, IN, CO, DE, RE, SY.`
        );
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(transformation, null, 2),
          },
        ],
      };
    }
  );

  // Resource: All models (complete framework)
  server.registerResource(
    "all-models",
    "hummbl://models",
    {
      title: "All HUMMBL Models",
      description: "Complete Base120 framework with all 120 mental models.",
      mimeType: "application/json",
    },
    async (uri: URL) => {
      const allModels = getAllModels();

      const payload = {
        version: "1.0.0-beta.1",
        model_count: allModels.length,
        models: allModels,
      };

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }
  );
}
