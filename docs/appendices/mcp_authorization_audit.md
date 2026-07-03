# MCP Authorization Audit Appendix

## Status

- **Concept status:** candidate
- **Canon status:** not canon
- **Advisory:** This appendix is advisory only. It is not a claim that this repo currently has an MCP vulnerability, not a blocking gate, and not approval to modify dependency automation without review.
- **Issue:** #327
- **Parent:** #316

## Purpose

Extend the MCP tool admission work (#316) with authorization audit guidance for HTTP authorization flows, and document the `dependency_update_receipt` candidate for risk-ranking dependency update churn.

## MCP Authorization Checks

### Resource Indicators

MCP servers exposing HTTP transports should use resource indicators (RFC 8707) to bind tokens to specific resources. This prevents token replay across different MCP servers.

| Check | Description |
|-------|-------------|
| `resource_indicator_present` | OAuth token request includes a `resource` parameter |
| `resource_indicator_bound` | Token is bound to the specific MCP server resource URI |
| `resource_indicator_validated` | Server validates the resource indicator on each request |

### Token Audience Validation

| Check | Description |
|-------|-------------|
| `audience_claim_present` | JWT token includes an `aud` claim |
| `audience_matches_server` | `aud` claim matches the MCP server's identifier |
| `audience_rejected_on_mismatch` | Server rejects tokens with mismatched audience |

### No Token Passthrough

| Check | Description |
|-------|-------------|
| `no_token_forwarding` | MCP server does not forward incoming tokens to downstream services |
| `no_token_logging` | Tokens are not logged in any form |
| `token_minimized_in_memory` | Tokens are held in memory for the minimum necessary duration |

### Transport-Specific Checks

| Transport | Authorization Concern |
|-----------|----------------------|
| `stdio` | Process-level isolation; no token needed if parent process is trusted |
| `http` | OAuth 2.1 with PKCE; resource indicators; audience validation |
| `websocket` | Same as HTTP plus origin validation |
| `sse` | Same as HTTP plus event source validation |
| `cloudflare_worker` | Worker-level auth; no token passthrough to origin |

## Dependency Update Receipt

### Candidate Fields

Per issue #327 spec:

| Field | Type | Description |
|-------|------|-------------|
| `package_name` | string | Name of the dependency being updated |
| `current_version` | string | Current installed version |
| `target_version` | string | Version to update to |
| `update_source` | enum | dependabot, renovate, manual, security_advisory, npm_audit, other |
| `security_fix_claimed` | boolean | Whether the update claims to fix a security issue |
| `security_source` | string? | URL or reference to the advisory |
| `runtime_surface` | enum | dev_dependency, runtime_dependency, build_tool, type_definition, test_dependency, config_dependency |
| `breaking_change_risk` | enum | none, low, medium, high, critical |
| `tests_required` | boolean | Whether tests must pass before merge |
| `tests_observed` | object | Test status, count, coverage delta |
| `review_owner` | string | Who is responsible for reviewing this update |
| `merge_recommendation` | enum | merge, hold, quarantine, unknown |
| `residual_risk` | string | Known risk remaining after the decision |
| `do_not_infer` | list | Prohibited inferences |

### Key Design Decisions

- `security_fix_claimed` is a boolean, not a severity — the security source must be verified independently
- `security_source` is required when `security_fix_claimed` is true (validator enforces)
- `tests_required` + `tests_observed.status` consistency is checked
- `do_not_infer` is required to prevent urgency language from bypassing review

## Do Not Infer

- Do not infer that a dependency update is safe because it comes from Dependabot.
- Do not infer that a security fix is critical based solely on update body text.
- Do not infer that tests passing means the update has no breaking changes.
- Do not infer that a minor version bump has no breaking changes.
- Do not merge based on urgency language in the update body without independent verification.

## Non-goals

- Not a replacement for npm audit or Dependabot.
- Not a blocking gate for all dependency updates.
- Not approval to auto-merge security updates without review.
- Not a vulnerability scanner.
