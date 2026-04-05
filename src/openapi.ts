/**
 * OpenAPI 3.0 specification for the HUMMBL REST API.
 *
 * Hand-written and served at GET /openapi.json for third-party
 * integrators and for import into API clients (Postman, Insomnia,
 * Hoppscotch, Swagger UI, etc).
 *
 * Keep this in sync with the routes in api.ts. If you add or remove
 * a route, update the corresponding `paths` entry below.
 */

import { SERVER_VERSION } from "./version.js";

type JsonSchema = Record<string, unknown>;
type Operation = Record<string, unknown>;
type PathItem = Record<string, Operation>;

const modelSchema: JsonSchema = {
  type: "object",
  properties: {
    code: { type: "string", example: "P1" },
    name: { type: "string" },
    definition: { type: "string" },
    priority: { type: "integer" },
  },
  required: ["code", "name", "definition", "priority"],
};

const transformationSchema: JsonSchema = {
  type: "object",
  properties: {
    key: { type: "string", enum: ["P", "IN", "CO", "DE", "RE", "SY"] },
    name: { type: "string" },
    description: { type: "string" },
  },
  required: ["key", "name", "description"],
};

const relationshipSchema: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    model_a: { type: "string" },
    model_b: { type: "string" },
    relationship_type: {
      type: "string",
      enum: ["enables", "reinforces", "conflicts", "contains", "sequences", "complements"],
    },
    direction: { type: "string", enum: ["a→b", "b→a", "bidirectional"] },
    confidence: { type: "string", enum: ["A", "B", "C", "U"] },
    logical_derivation: { type: "string" },
    review_status: {
      type: "string",
      enum: ["draft", "reviewed", "confirmed", "disputed"],
    },
    validated_by: { type: "string" },
    validated_at: { type: "string", format: "date-time" },
  },
  required: [
    "id",
    "model_a",
    "model_b",
    "relationship_type",
    "direction",
    "confidence",
    "logical_derivation",
    "review_status",
  ],
};

const bearerAuth = [{ bearerAuth: [] }];

const paths: Record<string, PathItem> = {
  "/health": {
    get: {
      tags: ["System"],
      summary: "Health check",
      description: "Returns server status, version, and model count. Unauthenticated.",
      responses: {
        "200": {
          description: "Server is healthy.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", example: "healthy" },
                  version: { type: "string" },
                  timestamp: { type: "string", format: "date-time" },
                  models_count: { type: "integer", example: 120 },
                },
              },
            },
          },
        },
      },
    },
  },

  "/openapi.json": {
    get: {
      tags: ["System"],
      summary: "This OpenAPI specification.",
      responses: {
        "200": {
          description: "The OpenAPI 3.0 document describing this API.",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },

  "/v1/models": {
    get: {
      tags: ["Models"],
      summary: "List all 120 mental models.",
      security: bearerAuth,
      responses: {
        "200": {
          description: "All models.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  count: { type: "integer" },
                  models: { type: "array", items: modelSchema },
                },
              },
            },
          },
        },
        "401": { description: "Unauthenticated." },
        "429": { description: "Rate limit exceeded." },
      },
    },
  },

  "/v1/models/{code}": {
    get: {
      tags: ["Models"],
      summary: "Get a specific model by code.",
      security: bearerAuth,
      parameters: [
        {
          name: "code",
          in: "path",
          required: true,
          schema: { type: "string", pattern: "^(P|IN|CO|DE|RE|SY)\\d{1,2}$" },
          example: "P1",
        },
      ],
      responses: {
        "200": { description: "Model.", content: { "application/json": { schema: modelSchema } } },
        "404": { description: "Model not found." },
      },
    },
  },

  "/v1/models/{code}/relationships": {
    get: {
      tags: ["Relationships"],
      summary: "Relationships touching a specific model.",
      parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Relationships for the model.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  model: { type: "string" },
                  relationships: { type: "array", items: { type: "object" } },
                },
              },
            },
          },
        },
      },
    },
  },

  "/v1/search": {
    get: {
      tags: ["Models"],
      summary: "Search models by keyword.",
      security: bearerAuth,
      parameters: [
        { name: "q", in: "query", required: true, schema: { type: "string", minLength: 2 } },
      ],
      responses: {
        "200": {
          description: "Matching models.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  query: { type: "string" },
                  matchCount: { type: "integer" },
                  results: { type: "array", items: modelSchema },
                },
              },
            },
          },
        },
      },
    },
  },

  "/v1/transformations": {
    get: {
      tags: ["Transformations"],
      summary: "List all 6 transformations.",
      security: bearerAuth,
      responses: {
        "200": {
          description: "Transformations.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  count: { type: "integer" },
                  transformations: { type: "array", items: transformationSchema },
                },
              },
            },
          },
        },
      },
    },
  },

  "/v1/transformations/{key}": {
    get: {
      tags: ["Transformations"],
      summary: "Get one transformation with its models.",
      security: bearerAuth,
      parameters: [
        {
          name: "key",
          in: "path",
          required: true,
          schema: { type: "string", enum: ["P", "IN", "CO", "DE", "RE", "SY"] },
        },
      ],
      responses: {
        "200": { description: "Transformation." },
        "404": { description: "Unknown transformation key." },
      },
    },
  },

  "/v1/recommend": {
    post: {
      tags: ["Models"],
      summary: "Recommend models for a problem description.",
      security: bearerAuth,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                problem: {
                  type: "string",
                  minLength: 10,
                  description: "Natural-language problem description.",
                },
              },
              required: ["problem"],
            },
          },
        },
      },
      responses: {
        "200": { description: "Ranked recommendations." },
        "400": { description: "Problem description too short." },
      },
    },
  },

  "/v1/relationships": {
    get: {
      tags: ["Relationships"],
      summary: "List relationships with optional filters.",
      parameters: [
        { name: "type", in: "query", schema: { type: "string" } },
        { name: "confidence", in: "query", schema: { type: "string", enum: ["A", "B", "C", "U"] } },
        { name: "status", in: "query", schema: { type: "string" } },
      ],
      responses: {
        "200": {
          description: "Relationships.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  count: { type: "integer" },
                  relationships: { type: "array", items: relationshipSchema },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ["Relationships"],
      summary: "Create a relationship (admin only).",
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { "application/json": { schema: relationshipSchema } },
      },
      responses: {
        "201": { description: "Relationship created." },
        "400": { description: "Invalid body." },
        "403": { description: "Admin permissions required." },
        "409": { description: "Duplicate relationship." },
      },
    },
  },

  "/v1/relationships/{id}": {
    get: {
      tags: ["Relationships"],
      summary: "Get a relationship by id.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Relationship.",
          content: { "application/json": { schema: relationshipSchema } },
        },
        "404": { description: "Not found." },
      },
    },
    patch: {
      tags: ["Relationships"],
      summary: "Update a relationship (admin only).",
      security: bearerAuth,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: { content: { "application/json": { schema: { type: "object" } } } },
      responses: {
        "200": { description: "Updated." },
        "403": { description: "Admin permissions required." },
      },
    },
    delete: {
      tags: ["Relationships"],
      summary: "Delete a relationship (admin only).",
      security: bearerAuth,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": { description: "Deleted." },
        "403": { description: "Admin permissions required." },
        "404": { description: "Not found." },
      },
    },
  },

  "/v1/graph": {
    get: {
      tags: ["Relationships"],
      summary: "Export relationship graph data for visualisation.",
      parameters: [
        { name: "format", in: "query", schema: { type: "string", enum: ["json", "cytoscape"] } },
        { name: "confidence_min", in: "query", schema: { type: "string" } },
        { name: "status", in: "query", schema: { type: "string" } },
      ],
      responses: { "200": { description: "Graph nodes and edges." } },
    },
  },
};

/** Build the full OpenAPI 3.0 document. */
export function buildOpenApiDocument(): Record<string, unknown> {
  return {
    openapi: "3.0.3",
    info: {
      title: "HUMMBL API",
      description:
        "REST API backing the HUMMBL MCP Server — access to the Base120 mental-models framework, recommendations, and the relationship graph.",
      version: SERVER_VERSION,
      license: { name: "MIT" },
    },
    servers: [
      { url: "https://api.hummbl.io", description: "Production" },
      { url: "http://localhost:8787", description: "Local wrangler dev" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "API key as a Bearer token. Keys follow the format `hummbl_<16+ chars>`.",
        },
      },
    },
    tags: [
      { name: "System", description: "Health & metadata." },
      { name: "Models", description: "120 Base120 mental models." },
      { name: "Transformations", description: "The 6 cognitive transformations." },
      { name: "Relationships", description: "Model relationship graph." },
    ],
    paths,
  };
}

/** Shared instance, built once at module load. */
export const OPENAPI_DOCUMENT = buildOpenApiDocument();

/** The list of documented path + method pairs (used by tests to guard drift). */
export const DOCUMENTED_OPERATIONS: Array<{ path: string; method: string }> = Object.entries(
  paths
).flatMap(([path, item]) => Object.keys(item).map((method) => ({ path, method })));
