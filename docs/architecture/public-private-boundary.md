# Public MCP vs Private User-Model Runtime Boundary

## Purpose

Document the architectural boundary between the public read-only MCP
server surface and the future private user-model runtime.

This boundary preserves the existing public no-user-data posture while
the private user-model runtime is designed.

Refs: hummbl-dev/mcp-server#377, hummbl-dev/hummbl-dev#149

## Public MCP Surface (this repo)

### Allowed public surfaces

- Canonical Base120/HUMMBL mental-model lookup
- Transformation and model search
- Nonpersonal problem-pattern/model recommendations
- Public schemas and documentation
- Candidate models deliberately published after explicit consent/admission
- Aggregate or de-identified artifacts only under separately reviewed policy

### Prohibited public surfaces

- Raw user voice/text observations
- Private user-model fragments
- Inferred personal traits, health states, relationships, or behavior profiles
- Private predictions or counterfactuals
- Personal consent or visibility metadata
- Private model graph traversal
- Mutation of durable user-model state
- Access based only on possession of a public MCP endpoint

## Private User-Model Runtime (future, separate)

The private runtime will handle:

- User voice/text observation ingestion
- Personal world-model fragment storage
- Inferred personal traits and behavior profiles
- Private predictions and counterfactuals
- Personal consent and visibility metadata
- Private model graph traversal
- Durable user-model state mutation

The private runtime requires:

- Authenticated access (OAuth, session, or API key)
- Policy-gated data access
- Separate storage from public data
- Audit logging for all personal data access

## Tool/Resource Inventory Classification

### Public tools (current)

| Tool | User-data risk | Classification |
|------|---------------|----------------|
| `get_model` | None | Public read-only |
| `search_models` | None | Public read-only |
| `get_transformation` | None | Public read-only |
| `recommend_models` | None | Public read-only (nonpersonal) |
| `get_methodology` | None | Public read-only |
| `export_models` | None | Public read-only |
| `get_workflow` | None | Public read-only |

### Public resources (current)

| Resource | User-data risk | Classification |
|----------|---------------|----------------|
| `models://all` | None | Public read-only |
| `models://{code}` | None | Public read-only |
| `methodology://{key}` | None | Public read-only |

### Future private tools (not implemented)

| Tool | User-data risk | Classification |
|------|---------------|----------------|
| `ingest_observation` | High | Private authenticated |
| `get_user_model` | High | Private authenticated |
| `get_user_prediction` | High | Private authenticated |
| `update_user_consent` | High | Private authenticated |

## Redaction and Error-Message Rules

1. **No raw payload echo**: Error messages must not include raw user input
   that could contain personal data.
2. **Generic error codes**: Use generic error codes (`INVALID_INPUT`,
   `NOT_FOUND`, `UNAUTHORIZED`) without revealing internal state.
3. **Log redaction**: All logs must redact any field that could contain
   personal observations (voice text, free-form input).
4. **Cache isolation**: Public caches must never contain user-model data.
5. **Stack trace suppression**: Production errors must not expose stack
   traces to public callers.

## CI Guard

The CI guard (`src/__tests__/public-boundary.test.ts`) enforces:

1. No public tool accepts user-profile or private-graph input fields
2. No public tool performs durable mutation
3. No public tool returns user-model fragments
4. Tool schemas are scanned for prohibited field names
5. Resource URIs cannot enumerate private identifiers

## Cross-References

- Parent: `hummbl-dev/hummbl-dev#149` — User-Driven World Model Generation v0.1
- Voice/runtime: `hummbl-dev/hummbl-dev#124`
- This issue: `hummbl-dev/mcp-server#377`
