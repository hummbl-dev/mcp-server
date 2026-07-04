# Agent Skill Admission Receipt

Status: draft (issue-facing standard)

The MCP transport admission path and skill admission path are separate:
`agent_skill_admission_receipt` governs runtime capability onboarding;
`mcp_tool_admission` governs transport-level tool enablement.

## Purpose

Define a distinct admission record for skills so a skill can be reviewed, approved,
or blocked independent of MCP transport/tool listing changes.

## Receipt Schema

```json
{
  "title": "AgentSkillAdmissionReceipt",
  "type": "object",
  "required": [
    "receipt_id",
    "skill_name",
    "skill_origin",
    "permission_model",
    "prompt_injection_controls",
    "runtime_scope",
    "reviewer",
    "review_outcome",
    "created_at"
  ],
  "properties": {
    "receipt_id": { "type": "string" },
    "skill_name": { "type": "string" },
    "skill_origin": {
      "type": "object",
      "required": ["source_type", "source_ref", "source_uri"],
      "properties": {
        "source_type": { "type": "string", "description": "repo, package, policy catalog, internal branch" },
        "source_ref": { "type": "string" },
        "source_uri": { "type": "string" }
      }
    },
    "permission_model": {
      "type": "object",
      "required": ["scope", "capabilities", "network_permissions", "write_permissions"],
      "properties": {
        "scope": { "type": "string" },
        "capabilities": { "type": "array", "items": { "type": "string" } },
        "network_permissions": { "type": "string", "enum": ["none", "limited", "allowlisted", "full"] },
        "write_permissions": { "type": "string", "enum": ["none", "template", "approved-paths-only", "full"] }
      }
    },
    "prompt_injection_controls": {
      "type": "object",
      "required": ["input_validation", "policy_enforced", "tool_output_safety"],
      "properties": {
        "input_validation": { "type": "string" },
        "policy_enforced": { "type": "boolean" },
        "tool_output_safety": { "type": "string" }
      }
    },
    "runtime_scope": {
      "type": "object",
      "required": ["allowed_clients", "allowed_environments", "max_execution_duration_ms"],
      "properties": {
        "allowed_clients": { "type": "array", "items": { "type": "string" } },
        "allowed_environments": { "type": "array", "items": { "type": "string" } },
        "max_execution_duration_ms": { "type": "integer" }
      }
    },
    "review_outcome": {
      "type": "string",
      "enum": ["pass", "warn", "block"]
    },
    "reviewer": { "type": "string" },
    "residual_risk": { "type": "string" },
    "created_at": { "type": "string", "format": "date-time" },
    "escalation_path": { "type": "string" },
    "test_plan": { "type": "string" }
  }
}
```

## Gating Checklist Before Skill Activation

- Verify origin and pin to immutable source ref
- Verify allowed scope and tool capability list is minimal
- Verify prompt-injection controls are active and tested
- Verify policy or safety fences remain in place for output and network use
- Record escalation path for blocked or unsafe behavior
- Record residual risk and next review date

## Escalation Path

- `warn`: continue with restricted scope and review before wider rollout
- `block`: no activation until explicit approval from human reviewer + risk owner

## Distinction: Skill Admission vs MCP Tool Admission

- MCP tool admission controls transport/tool registration and tool availability.
- Agent skill admission controls what the skill is allowed to do at runtime, including
  permission, prompt-injection exposure, and operational scope.
- A skill may require a full receipt even if the MCP transport remains unchanged.
