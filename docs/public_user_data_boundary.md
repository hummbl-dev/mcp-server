# Public MCP User-Data Boundary

## Status

This document preserves the current public MCP boundary. It is not a private
user-model runtime design, a consent system, or an authorization claim.

## Public MCP responsibilities

The public MCP surface may provide canonical model lookup, transformation and
problem-pattern search, nonpersonal recommendations, public schemas, and
deliberately admitted public artifacts. It must remain read-only.

## Prohibited public responsibilities

The public MCP surface must not accept or return raw observations, personal
profiles, health or relationship inferences, private graph fragments, consent
metadata, or durable user-model mutations. Possession of a public endpoint is
not authorization to access private user-model material.

## Tool and resource inventory

The public tool inventory is enforced by
`src/__tests__/public-tool-profile.test.ts`:

- Allowed tools: `get_model`, `list_all_models`, `search_models`,
  `get_transformation`, `search_problem_patterns`, `recommend_models`,
  `get_related_models`, and `get_methodology`.
- Excluded tools include relationship mutation, export, workflow execution,
  recommendation-history access, and reference auditing.
- Public resources and prompts must describe canonical or nonpersonal material
  only and must not enumerate private user identifiers.

## Threat and redaction rules

- Public tool schemas must reject private user-model field names.
- Public handlers must not persist caller observations or private payloads.
- Public errors and logs must not echo raw personal input or private graph data.
- A public candidate artifact requires an explicit admitted/public posture;
  unpublished material remains unavailable.

## Future private adapter

`src/types/private_user_model_adapter.ts` defines a boundary-only contract for
a future authenticated adapter. It is not registered by the public MCP server.
Any implementation requires separate authentication, consent, visibility,
retention, and policy-gate admission.
