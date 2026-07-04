# MCP Tool Admission Receipt

## Status

- **Concept status:** candidate (advisory routing issue, not canon)
- **Issue:** #316
- **Date:** 2026-07-01

## Purpose

MCP servers and tools are high-leverage but high-risk fleet surfaces. They need identity, authorization, sandbox posture, command-surface review, transport constraints, attestation, revocation, logging, and receipt behavior before broad agent use.

HUMMBL should not treat "tool exists" as equivalent to "tool is admissible."

## Receipt Schema

The `mcp_tool_admission_receipt` schema captures:

| Field | Description |
|-------|-------------|
| `tool_name` | Name of the MCP tool |
| `server_name` | Name of the MCP server hosting the tool |
| `version_or_ref` | Version or git ref |
| `owner` | Owner of the tool/server |
| `transport` | Transport protocol (stdio, http, sse, websocket, custom) |
| `authentication_required` | Whether authentication is required |
| `authorization_model` | Authorization model (local_only, oauth, etc.) |
| `command_surface` | List of commands/operations the tool exposes |
| `network_access` | Network access level (none, outbound, inbound, bidirectional) |
| `filesystem_access` | Filesystem access level (none, read, write, read_write) |
| `secret_access` | Secret access level (none, read, write, read_write) |
| `sandbox_posture` | Sandbox posture (isolated, containerized, host, unknown) |
| `logging_and_receipts` | Whether logging and receipts are produced |
| `revocation_path` | How to revoke admission |
| `known_risks` | Known risks |
| `allowed_scopes` | Scopes the tool is allowed to operate in |
| `disabled_by_default_commands` | Commands disabled by default |
| `admission_decision` | admit, admit_with_scope, quarantine, reject, unknown |
| `reviewer` | Who reviewed the tool |
| `evidence_pointers` | Pointers to evidence (source files, docs) |
| `do_not_infer` | What not to infer from this receipt |

## Admission Decisions

| Decision | Meaning |
|----------|---------|
| `admit` | Tool is safe for use within its allowed scopes |
| `admit_with_scope` | Tool is admitted but only within specific scopes |
| `quarantine` | Tool is unknown — further review required before use |
| `reject` | Tool is rejected — do not use |
| `unknown` | Not enough information to make a decision |

**Key principle:** `unknown` is distinct from `safe`. A tool with unknown provenance, unknown sandbox posture, or unknown risks should be `quarantine` or `unknown`, not `admit`.

## Self-Audit Fixtures

| Fixture | Tool | Decision | Notes |
|---------|------|----------|-------|
| `admit_get_model.json` | `get_model` | admit | Local-only, read-only, no network |
| `admit_with_scope_export.json` | `export_models` | admit_with_scope | Writes to filesystem, scoped to base120:export |
| `quarantine_execute_shell.json` | `execute_shell` | quarantine | Unknown owner, no sandbox, secret access |

## High-Risk Command Surfaces

Commands that should be `disabled_by_default`:

- `execute_shell` — arbitrary command execution
- `delete_file` — irreversible filesystem operation
- `send_email` — externally visible communication
- `make_payment` — financial action
- `deploy` — production deployment

## Relationship to MCP Tool Admission

MCP tool admission is the protocol-level control for which tools an agent may call. It is distinct from:

1. **Agent skill admission** (#333) — controls which skills/repo instructions an agent may load
2. **Runtime authorization** — controls what an agent may do at runtime
3. **Network admission** — controls which network endpoints an agent may reach

These are separate control surfaces because:
- A tool may be admissible but a skill that uses it may not be
- A skill may be admissible but a tool it calls may not be
- Admission is per-surface, not global

## Documentation

Admission is **scoped and revocable**, not permanent trust.

- **Scoped:** A tool admitted for one scope (e.g., `base120:read`) is not automatically admitted for other scopes
- **Revocable:** Admission can be revoked at any time via the `revocation_path`
- **Not permanent:** Admission does not imply the tool will remain safe forever

## Follow-Up Architecture Decision

Cross-repo adoption of this receipt schema should be tracked as a follow-up architecture decision in `hummbl-framework-crosswalks` or the governance kernel.

## Do Not Infer

- This issue does not claim this repo currently has an MCP vulnerability
- This receipt is a self-audit primitive, not a security certification
- Admission is not permanent trust
- `unknown` is not `safe`
