# Agent Skill Admission Receipt

## Status

- **Concept status:** candidate (advisory, not canon)
- **Issue:** #333
- **Date:** 2026-07-01

## Purpose

Add explicit `agent_skill_admission_receipt` control for agent skill onboarding, separate from MCP transport/tool admission.

Skill/repo instruction admission is a distinct control surface from MCP tool access. A skill may be admissible while the tools it calls are not, and vice versa.

## Receipt Schema

The `agent_skill_admission_receipt` captures:

| Field | Description |
|-------|-------------|
| `skill_name` | Name of the skill |
| `skill_source` | Source path or URL |
| `skill_version` | Version of the skill |
| `origin` | local, fleet, community, unknown |
| `owner` | Owner of the skill |
| `permission_model` | unrestricted, scoped, sandboxed, gated, unknown |
| `scope` | Scopes the skill is allowed to operate in |
| `prompt_injection_risk_controls` | Controls for prompt injection risk |
| `command_surface` | Commands/operations the skill exposes |
| `network_access` | Network access level |
| `filesystem_access` | Filesystem access level |
| `secret_access` | Secret access level |
| `review_outcome` | admit, admit_with_scope, quarantine, reject, unknown |
| `review_checklist` | 10-item gating checklist |
| `reviewer` | Who reviewed the skill |
| `evidence_pointers` | Pointers to evidence |
| `escalation_path` | Path for escalating unsafe behavior |

## Gating Checklist

Before activating a new skill runtime, all 10 items must be checked:

1. `source_verified` — Skill source is verified
2. `permission_model_reviewed` — Permission model is reviewed
3. `scope_bounded` — Skill scope is bounded
4. `prompt_injection_risk_assessed` — Prompt injection risk is assessed
5. `command_surface_reviewed` — Command surface is reviewed
6. `network_access_reviewed` — Network access is reviewed
7. `filesystem_access_reviewed` — Filesystem access is reviewed
8. `secret_access_reviewed` — Secret access is reviewed
9. `revocation_path_defined` — Revocation path is defined
10. `logging_enabled` — Logging is enabled

## Escalation Path

For unsafe or untrusted skill behavior:

1. **Disable** the skill in agent config
2. **Escalate** to operator for manual review
3. **Document** the unsafe behavior in the receipt's `do_not_infer` section
4. **Revoke** admission if the behavior is confirmed unsafe

## Relationship to MCP Tool Admission

| Control Surface | What It Controls | Receipt |
|----------------|-----------------|---------|
| Agent skill admission | Which skills/repo instructions an agent may load | `agent_skill_admission_receipt` |
| MCP tool admission | Which MCP tools an agent may call | `mcp_tool_admission_receipt` (#316) |
| Runtime authorization | What an agent may do at runtime | (future) |
| Network admission | Which network endpoints an agent may reach | (future) |

### Why They Are Distinct

1. **A skill may be admissible but a tool it calls may not be.** A skill that drafts emails is admissible, but the `send_email` MCP tool it calls may require separate admission.

2. **A tool may be admissible but a skill that uses it may not be.** The `get_model` MCP tool is admissible, but a community skill that wraps it with prompt injection risks may not be.

3. **Admission is per-surface, not global.** Admitting a skill does not automatically admit the tools it references. Admitting a tool does not automatically admit skills that use it.

4. **Different risk profiles.** Skills carry prompt injection risk (repo instructions, system prompts). Tools carry command execution risk (filesystem, network, secrets). These require different review checklists.

## Self-Audit Fixtures

| Fixture | Skill | Outcome | Notes |
|---------|-------|---------|-------|
| `admit_base120.json` | `base120` | admit | Fleet skill, local-only, read-only |
| `admit_with_scope_send_email.json` | `send-email` | admit_with_scope | Gated, operator approval required |
| `quarantine_unknown_community.json` | `unknown-community-skill` | quarantine | Unknown origin, no review possible |

## Do Not Infer

- This receipt is a self-audit primitive, not a security certification
- Admission is scoped and revocable, not permanent trust
- `unknown` is not `safe`
- Skill admission does not imply tool admission
