# OpenAPI Base120 REST Facade Plan

## Purpose

A thin REST API that wraps the HUMMBL Base120 model logic, enabling Custom GPT Actions and other non-MCP clients to access the model catalog.

## Architecture

```
Custom GPT / External Client
  └── OpenAPI schema (openapi.hummbl.io/base120.json)
        └── REST API (api.hummbl.io/v1/*)
              └── Shared model logic (src/framework/models.ts)
                    └── Base120 model catalog (data/models.json)
```

The REST facade reuses the same data layer as the MCP server. No duplicate logic.

## Endpoints

| Method | Path | Query/Body | Description |
|--------|------|------------|-------------|
| GET | `/v1/models` | `?transformation_filter=P` | List all 120 models, optionally filtered |
| GET | `/v1/models/{code}` | — | Get a single model by code (e.g., P1) |
| GET | `/v1/search` | `?query=belonging` | Search models by keyword |
| POST | `/v1/recommend` | `{"problem": "..."}` | Recommend models for a problem |
| GET | `/v1/transformations/{key}` | — | Get transformation details |
| GET | `/v1/methodology` | — | Get Self-Dialectical AI methodology |
| GET | `/v1/related/{code}` | — | Get models related to a specific model |
| GET | `/v1/patterns` | `?query=team` | Search problem patterns |

## Response format

All responses are JSON with CORS headers (`Access-Control-Allow-Origin: *`).

### Model object

```json
{
  "code": "P1",
  "name": "First Principles Framing",
  "definition": "Reduce complex problems to foundational truths that cannot be further simplified",
  "priority": 1,
  "transformation": "P"
}
```

### Error format

```json
{
  "error": "not_found",
  "message": "Model with code 'X1' not found",
  "status": 404
}
```

## Deployment

### Cloudflare Worker

| Field | Value |
|-------|-------|
| Worker name | `hummbl-api` |
| Entry | `dist/api-server.js` |
| Route | `api.hummbl.io/*` |
| Zone | `hummbl.io` |
| DNS | `api.hummbl.io` AAAA `100::` (proxied) |

### OpenAPI schema hosting

The OpenAPI JSON file can be served:
- From the same Worker at `/openapi.json`
- From Cloudflare Pages at `openapi.hummbl.io`
- From GitHub Pages (current Pages deployment)

Recommended: serve from the Worker at `https://api.hummbl.io/openapi.json` and redirect `openapi.hummbl.io/base120.json` to it.

## Rate limiting

Initial rate limits (no auth):

| Scope | Limit |
|-------|-------|
| Per IP | 60 requests/minute |
| Per IP | 1000 requests/hour |
| Global | 10000 requests/hour |

Implementation: Cloudflare WAF rate limiting rules or in-Worker token bucket.

## Auth (future)

| Phase | Auth |
|-------|------|
| MVP | None (public read-only, rate-limited) |
| V1 | API key for programmatic access |
| V2 | OAuth for user accounts |

## Build sequence

1. Create `src/api-server.ts` with route handlers
2. Reuse existing framework functions (`getAllModels`, `getModel`, `searchModels`, etc.)
3. Add CORS headers
4. Add rate limiting
5. Generate OpenAPI schema (can be hand-written or generated from route definitions)
6. Deploy Worker to `api.hummbl.io`
7. Create DNS record
8. Publish OpenAPI schema
9. Test with Custom GPT Actions

## File structure

```
src/
  api-server.ts          # REST facade entry point
  framework/
    models.ts            # Shared model logic (already exists)
    methodology.ts       # Shared methodology logic (already exists)
  tools/
    models.ts            # MCP tool definitions (already exists)
    methodology.ts       # MCP tool definitions (already exists)
```

The REST facade imports from `src/framework/` — the same source the MCP tools use.

## References

- [Configuring Actions in GPTs](https://help.openai.com/en/articles/9442513-configuring-actions-in-gpts)
- [OpenAPI Specification](https://spec.openapis.org/oas/v3.1.0)
