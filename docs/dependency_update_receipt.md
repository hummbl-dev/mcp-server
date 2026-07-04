# Dependency Update Receipt

## Status

- **Concept status:** candidate (advisory, not canon)
- **Issue:** #327
- **Date:** 2026-07-01

## Purpose

Risk-rank dependency update churn with an evidence-bounded receipt. This does not merge or block updates by itself — it defines an evidence shape for later review.

## Receipt Schema

The `dependency_update_receipt` captures:

| Field | Description |
|-------|-------------|
| `package_name` | Name of the package being updated |
| `current_version` | Current installed version |
| `target_version` | Target version to update to |
| `update_source` | dependabot, renovate, manual, security_advisory, unknown |
| `security_fix_claimed` | Whether the update claims to fix a security issue |
| `security_source` | Source of the security claim (advisory URL, or null) |
| `runtime_surface` | dev_dependency, runtime_dependency, build_tool, type_definition, unknown |
| `breaking_change_risk` | low, medium, high, unknown |
| `tests_required` | Whether tests should be run before merge |
| `tests_observed` | passed, failed, not_run, unknown |
| `review_owner` | Who owns the review decision |
| `merge_recommendation` | merge, hold, quarantine, unknown |
| `residual_risk` | Known residual risks after merge |
| `evidence_pointers` | Pointers to evidence (package.json, test output, advisory URL) |

## Merge Recommendations

| Recommendation | Meaning |
|---------------|---------|
| `merge` | Update is safe — tests pass, low risk |
| `hold` | Update needs verification — tests or advisory verification required |
| `quarantine` | Update is unknown — source, risk, or surface is unknown |
| `unknown` | Not enough information to make a recommendation |

## Key Principles

1. **`security_fix_claimed` does not mean verified.** A Dependabot claim that an update fixes a security issue must be verified against the advisory source.

2. **`unknown` is not `safe`.** A package with unknown source, unknown runtime surface, or unknown breaking change risk should be `quarantine`, not `merge`.

3. **Evidence over urgency.** Security urgency does not override evidence requirements. Any Dependabot/security language must be tied to source evidence, not inferred from urgency.

4. **Tests are required for runtime dependencies.** `tests_required` should be `true` for `runtime_dependency` updates. `tests_observed` must be `passed` before `merge`.

## Self-Audit Fixtures

| Fixture | Package | Recommendation | Notes |
|---------|---------|---------------|-------|
| `merge_workers_types.json` | `@cloudflare/workers-types` | merge | Dev dependency, low risk, tests pass |
| `hold_hono_security.json` | `hono` | hold | Security fix claimed but not verified, tests not run |
| `quarantine_unknown.json` | `unknown-package` | quarantine | Unknown source, major version bump |

## Relationship to #316

This receipt is a sibling to the `mcp_tool_admission_receipt` (#316). Both use the same decision vocabulary (admit/merge, hold, quarantine, unknown) but address different surfaces:

- `mcp_tool_admission_receipt` — controls which MCP tools an agent may call
- `dependency_update_receipt` — controls which dependency updates may be merged

## Do Not Infer

- This receipt does not merge or block updates by itself
- `security_fix_claimed` does not mean the fix is verified
- `unknown` is not `safe`
- This is an evidence shape for review, not automation
