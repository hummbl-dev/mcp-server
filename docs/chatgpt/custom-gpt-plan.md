# HUMMBL Custom GPT Plan

## Working name

```
HUMMBL Problem Framer
```

## Purpose

```
A GPT that helps users clarify problems, select relevant Base120 models,
and generate structured next actions.
```

## Architecture

```
Custom GPT
  ├── Instructions (system prompt)
  ├── Knowledge (HUMMBL methodology docs)
  ├── Actions (OpenAPI schema → REST facade)
  │     └── api.hummbl.io/v1/*
  └── Distribution (public link or GPT store)
```

## REST/OpenAPI facade

A Custom GPT Action does **not** call MCP directly. It calls REST endpoints defined by an OpenAPI schema. We need a thin REST facade that wraps the same logic as the MCP tools.

### Endpoints

| Method | Path | Description | MCP tool equivalent |
|--------|------|-------------|---------------------|
| GET | `/v1/models` | List all 120 Base120 models | `list_all_models` |
| GET | `/v1/models/{code}` | Get a model by code | `get_model` |
| GET | `/v1/search?query={q}` | Search models by keyword | `search_models` |
| POST | `/v1/recommend` | Recommend models for a problem | `recommend_models` |
| GET | `/v1/transformations/{key}` | Get transformation details | `get_transformation` |
| GET | `/v1/methodology` | Get Self-Dialectical AI methodology | `get_methodology` |
| GET | `/v1/related/{code}` | Get related models | `get_related_models` |
| GET | `/v1/patterns?query={q}` | Search problem patterns | `search_problem_patterns` |

### OpenAPI schema location

```
https://openapi.hummbl.io/base120.json
```

### Auth

- **Initial:** No auth (public read-only)
- **Future:** OAuth for user accounts and saved work

## Custom GPT configuration

### Instructions

```
You are the HUMMBL Problem Framer, an expert in the HUMMBL Base120
mental model system. Your job is to help users clarify messy problems
by identifying relevant mental models from the Base120 framework.

Process:
1. Listen to the user's problem description
2. Use the recommend endpoint to find relevant models
3. Present 3-5 recommended models with their codes, names, and definitions
4. Explain which transformation each model belongs to (P/IN/CO/DE/RE/SY)
5. Suggest a structured next action using the recommended models

Always be specific about which model to use and why. Reference models
by their code (e.g., P1, IN3) and name.
```

### Knowledge

Upload public HUMMBL methodology docs:
- Self-Dialectical AI methodology overview
- Base120 transformation descriptions
- Problem pattern catalog

### Actions

Point to the OpenAPI schema:
```
https://openapi.hummbl.io/base120.json
```

### Distribution

- **Initial:** Public link for testing
- **Future:** Submit to GPT Store

## REST facade implementation

### Option A: Cloudflare Worker (recommended)

Deploy a separate Worker at `api.hummbl.io` that wraps the existing tool logic:

```typescript
// src/api-server.ts
export default {
  async fetch(request: Request, env: unknown): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for browser access
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Route to appropriate handler
    if (path === "/v1/models") return handleListModels(corsHeaders);
    if (path.startsWith("/v1/models/")) return handleGetModel(path, corsHeaders);
    if (path === "/v1/search") return handleSearch(url, corsHeaders);
    if (path === "/v1/recommend") return handleRecommend(request, corsHeaders);
    if (path.startsWith("/v1/transformations/")) return handleGetTransformation(path, corsHeaders);
    if (path === "/v1/methodology") return handleGetMethodology(corsHeaders);
    if (path.startsWith("/v1/related/")) return handleGetRelated(path, corsHeaders);
    if (path === "/v1/patterns") return handleSearchPatterns(url, corsHeaders);

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
```

### Option B: Hono router

Use Hono for cleaner routing:
```typescript
import { Hono } from "hono";
const app = new Hono();

app.get("/v1/models", (c) => c.json(listAllModels()));
app.get("/v1/models/:code", (c) => c.json(getModel(c.req.param("code"))));
// ...
```

### Wrangler config

```toml
# wrangler.api.toml
name = "hummbl-api"
main = "dist/api-server.js"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[[routes]]
pattern = "api.hummbl.io/*"
zone_name = "hummbl.io"

[vars]
ENVIRONMENT = "production"
```

## OpenAPI schema draft

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "HUMMBL Base120 API",
    "version": "1.0.0",
    "description": "Search and reason over HUMMBL Base120 mental models."
  },
  "servers": [
    { "url": "https://api.hummbl.io" }
  ],
  "paths": {
    "/v1/models": {
      "get": {
        "summary": "List all Base120 models",
        "operationId": "listAllModels",
        "parameters": [
          {
            "name": "transformation_filter",
            "in": "query",
            "schema": { "type": "string", "enum": ["P","IN","CO","DE","RE","SY"] }
          }
        ],
        "responses": {
          "200": {
            "description": "List of models",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/ModelList" }
              }
            }
          }
        }
      }
    },
    "/v1/models/{code}": {
      "get": {
        "summary": "Get a model by code",
        "operationId": "getModel",
        "parameters": [
          {
            "name": "code",
            "in": "path",
            "required": true,
            "schema": { "type": "string", "pattern": "^(P|IN|CO|DE|RE|SY)\\d{1,2}$" }
          }
        ],
        "responses": {
          "200": {
            "description": "Model details",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/Model" }
              }
            }
          },
          "404": { "description": "Model not found" }
        }
      }
    },
    "/v1/search": {
      "get": {
        "summary": "Search models by keyword",
        "operationId": "searchModels",
        "parameters": [
          {
            "name": "query",
            "in": "query",
            "required": true,
            "schema": { "type": "string", "minLength": 2 }
          }
        ],
        "responses": {
          "200": {
            "description": "Search results",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/SearchResults" }
              }
            }
          }
        }
      }
    },
    "/v1/recommend": {
      "post": {
        "summary": "Recommend models for a problem",
        "operationId": "recommendModels",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "problem": { "type": "string", "minLength": 10 }
                },
                "required": ["problem"]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Recommendations",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/Recommendations" }
              }
            }
          }
        }
      }
    },
    "/v1/transformations/{key}": {
      "get": {
        "summary": "Get transformation details",
        "operationId": "getTransformation",
        "parameters": [
          {
            "name": "key",
            "in": "path",
            "required": true,
            "schema": { "type": "string", "enum": ["P","IN","CO","DE","RE","SY"] }
          }
        ],
        "responses": {
          "200": { "description": "Transformation details" }
        }
      }
    },
    "/v1/methodology": {
      "get": {
        "summary": "Get Self-Dialectical AI methodology",
        "operationId": "getMethodology",
        "responses": {
          "200": { "description": "Methodology details" }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "Model": {
        "type": "object",
        "properties": {
          "code": { "type": "string" },
          "name": { "type": "string" },
          "definition": { "type": "string" },
          "priority": { "type": "number" },
          "transformation": { "type": "string" }
        },
        "required": ["code", "name", "definition", "priority", "transformation"]
      },
      "ModelList": {
        "type": "object",
        "properties": {
          "total": { "type": "number" },
          "models": {
            "type": "array",
            "items": { "$ref": "#/components/schemas/Model" }
          }
        },
        "required": ["total", "models"]
      },
      "SearchResults": {
        "type": "object",
        "properties": {
          "query": { "type": "string" },
          "resultCount": { "type": "number" },
          "results": {
            "type": "array",
            "items": { "$ref": "#/components/schemas/Model" }
          }
        }
      },
      "Recommendations": {
        "type": "object",
        "properties": {
          "problem": { "type": "string" },
          "recommendationCount": { "type": "number" },
          "recommendations": { "type": "array" }
        }
      }
    }
  }
}
```

## Launch prerequisites

- [ ] REST facade deployed to `api.hummbl.io`
- [ ] OpenAPI schema published at `openapi.hummbl.io/base120.json`
- [ ] DNS records created (`api.hummbl.io`, `openapi.hummbl.io`)
- [ ] Privacy policy URL
- [ ] Terms of service URL
- [ ] Rate limits
- [ ] Custom GPT created and tested
- [ ] Test prompts verified

## References

- [Configuring Actions in GPTs](https://help.openai.com/en/articles/9442513-configuring-actions-in-gpts)
- [Apps SDK Quickstart](https://developers.openai.com/apps-sdk/quickstart)
