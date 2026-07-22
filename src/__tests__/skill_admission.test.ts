import { describe, it, expect } from "vitest";
import type { AgentSkillAdmissionReceipt } from "../types/skill_admission.js";

describe("AgentSkillAdmissionReceipt", () => {
  it("should accept a valid admit receipt", () => {
    const receipt: AgentSkillAdmissionReceipt = {
      schema_version: "0.1.0-candidate",
      receipt_id: "skill-adm-001",
      skill_name: "base120",
      skill_source: ".agents/skills/base120/SKILL.md",
      skill_version: "1.0.0",
      origin: "fleet",
      owner: "hummbl-dev",
      permission_model: "scoped",
      scope: ["base120:read"],
      prompt_injection_risk_controls: ["local_data_only"],
      command_surface: ["get_model"],
      network_access: "none",
      filesystem_access: "read",
      secret_access: "none",
      review_outcome: "admit",
      review_checklist: {
        source_verified: true,
        permission_model_reviewed: true,
        scope_bounded: true,
        prompt_injection_risk_assessed: true,
        command_surface_reviewed: true,
        network_access_reviewed: true,
        filesystem_access_reviewed: true,
        secret_access_reviewed: true,
        revocation_path_defined: true,
        logging_enabled: true,
      },
      reviewer: "operator",
      evidence_pointers: [".agents/skills/base120/SKILL.md"],
      escalation_path: "disable skill in agent config",
      do_not_infer: ["admission is revocable"],
      timestamp: "2026-07-01T00:00:00Z",
    };
    expect(receipt.review_outcome).toBe("admit");
    expect(receipt.skill_name).toBe("base120");
  });

  it("should accept a quarantine receipt with unknown fields", () => {
    const receipt: AgentSkillAdmissionReceipt = {
      schema_version: "0.1.0-candidate",
      receipt_id: "skill-adm-002",
      skill_name: "unknown-community-skill",
      skill_source: "https://github.com/unknown/skill",
      skill_version: "unknown",
      origin: "community",
      owner: "unknown",
      permission_model: "unknown",
      scope: [],
      prompt_injection_risk_controls: [],
      command_surface: ["unknown"],
      network_access: "unknown",
      filesystem_access: "unknown",
      secret_access: "unknown",
      review_outcome: "quarantine",
      review_checklist: {
        source_verified: false,
        permission_model_reviewed: false,
        scope_bounded: false,
        prompt_injection_risk_assessed: false,
        command_surface_reviewed: false,
        network_access_reviewed: false,
        filesystem_access_reviewed: false,
        secret_access_reviewed: false,
        revocation_path_defined: false,
        logging_enabled: false,
      },
      reviewer: "operator",
      evidence_pointers: [],
      escalation_path: "do not activate",
      do_not_infer: ["quarantine means unknown, not rejected"],
      timestamp: "2026-07-01T00:01:00Z",
    };
    expect(receipt.review_outcome).toBe("quarantine");
    expect(receipt.origin).toBe("community");
  });

  it("should accept an admit_with_scope receipt", () => {
    const receipt: AgentSkillAdmissionReceipt = {
      schema_version: "0.1.0-candidate",
      receipt_id: "skill-adm-003",
      skill_name: "send-email",
      skill_source: ".agents/skills/send-email/SKILL.md",
      skill_version: "0.5.0",
      origin: "fleet",
      owner: "hummbl-dev",
      permission_model: "gated",
      scope: ["email:send"],
      prompt_injection_risk_controls: ["operator_approval_required"],
      command_surface: ["send_email", "draft_email"],
      network_access: "outbound",
      filesystem_access: "none",
      secret_access: "read",
      review_outcome: "admit_with_scope",
      review_checklist: {
        source_verified: true,
        permission_model_reviewed: true,
        scope_bounded: true,
        prompt_injection_risk_assessed: true,
        command_surface_reviewed: true,
        network_access_reviewed: true,
        filesystem_access_reviewed: true,
        secret_access_reviewed: true,
        revocation_path_defined: true,
        logging_enabled: true,
      },
      reviewer: "operator",
      evidence_pointers: [".agents/skills/send-email/SKILL.md"],
      escalation_path: "disable skill, escalate to operator",
      do_not_infer: ["admission requires operator approval for each send"],
      timestamp: "2026-07-01T00:02:00Z",
    };
    expect(receipt.review_outcome).toBe("admit_with_scope");
    expect(receipt.permission_model).toBe("gated");
  });
});
