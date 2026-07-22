/**
 * Agent Skill Admission Receipt v0.1
 *
 * Receipt for admitting an agent skill into runtime use.
 * Distinct from MCP tool admission — controls skill/repo instruction onboarding.
 * Admission is scoped and revocable, not permanent trust.
 */

export interface AgentSkillAdmissionReceipt {
  schema_version: string;
  receipt_id: string;
  skill_name: string;
  skill_source: string;
  skill_version: string;
  origin: "local" | "fleet" | "community" | "unknown";
  owner: string;
  permission_model: "unrestricted" | "scoped" | "sandboxed" | "gated" | "unknown";
  scope: string[];
  prompt_injection_risk_controls: string[];
  command_surface: string[];
  network_access: "none" | "outbound" | "inbound" | "bidirectional" | "unknown";
  filesystem_access: "none" | "read" | "write" | "read_write" | "unknown";
  secret_access: "none" | "read" | "write" | "read_write" | "unknown";
  review_outcome: "admit" | "admit_with_scope" | "quarantine" | "reject" | "unknown";
  review_checklist: AgentSkillReviewChecklist;
  reviewer: string;
  evidence_pointers: string[];
  escalation_path: string;
  do_not_infer: string[];
  timestamp: string;
}

export interface AgentSkillReviewChecklist {
  source_verified: boolean;
  permission_model_reviewed: boolean;
  scope_bounded: boolean;
  prompt_injection_risk_assessed: boolean;
  command_surface_reviewed: boolean;
  network_access_reviewed: boolean;
  filesystem_access_reviewed: boolean;
  secret_access_reviewed: boolean;
  revocation_path_defined: boolean;
  logging_enabled: boolean;
}
