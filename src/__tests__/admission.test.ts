import { describe, it, expect } from "vitest";
import type { McpToolAdmissionReceipt } from "../types/admission.js";

describe("McpToolAdmissionReceipt", () => {
  it("should accept a valid admit receipt", () => {
    const receipt: McpToolAdmissionReceipt = {
      schema_version: "0.1.0-candidate",
      receipt_id: "mcp-adm-001",
      tool_name: "get_model",
      server_name: "@hummbl/mcp-server",
      version_or_ref: "1.2.0",
      owner: "hummbl-dev",
      transport: "stdio",
      authentication_required: false,
      authorization_model: "local_only",
      command_surface: ["get_model"],
      network_access: "none",
      filesystem_access: "read",
      secret_access: "none",
      sandbox_posture: "host",
      logging_and_receipts: true,
      revocation_path: "disable in client config",
      known_risks: ["reads local model data only"],
      allowed_scopes: ["base120:read"],
      disabled_by_default_commands: [],
      admission_decision: "admit",
      reviewer: "operator",
      evidence_pointers: ["src/tools/models.ts"],
      do_not_infer: ["does not imply all MCP tools are safe"],
      timestamp: "2026-07-01T00:00:00Z",
    };
    expect(receipt.admission_decision).toBe("admit");
    expect(receipt.tool_name).toBe("get_model");
  });

  it("should accept a quarantine receipt with unknown fields", () => {
    const receipt: McpToolAdmissionReceipt = {
      schema_version: "0.1.0-candidate",
      receipt_id: "mcp-adm-002",
      tool_name: "execute_shell",
      server_name: "unknown-third-party",
      version_or_ref: "unknown",
      owner: "unknown",
      transport: "http",
      authentication_required: false,
      authorization_model: "none",
      command_surface: ["execute_shell"],
      network_access: "bidirectional",
      filesystem_access: "read_write",
      secret_access: "read",
      sandbox_posture: "unknown",
      logging_and_receipts: false,
      revocation_path: "unknown",
      known_risks: ["arbitrary command execution"],
      allowed_scopes: [],
      disabled_by_default_commands: ["execute_shell"],
      admission_decision: "quarantine",
      reviewer: "operator",
      evidence_pointers: [],
      do_not_infer: ["quarantine means unknown, not rejected"],
      timestamp: "2026-07-01T00:01:00Z",
    };
    expect(receipt.admission_decision).toBe("quarantine");
    expect(receipt.sandbox_posture).toBe("unknown");
  });

  it("should accept an admit_with_scope receipt", () => {
    const receipt: McpToolAdmissionReceipt = {
      schema_version: "0.1.0-candidate",
      receipt_id: "mcp-adm-003",
      tool_name: "export_models",
      server_name: "@hummbl/mcp-server",
      version_or_ref: "1.2.0",
      owner: "hummbl-dev",
      transport: "stdio",
      authentication_required: false,
      authorization_model: "local_only",
      command_surface: ["export_models"],
      network_access: "none",
      filesystem_access: "write",
      secret_access: "none",
      sandbox_posture: "host",
      logging_and_receipts: true,
      revocation_path: "disable in client config",
      known_risks: ["writes to local filesystem"],
      allowed_scopes: ["base120:export"],
      disabled_by_default_commands: [],
      admission_decision: "admit_with_scope",
      reviewer: "operator",
      evidence_pointers: ["src/tools/export.ts"],
      do_not_infer: ["admission is scoped to base120:export only"],
      timestamp: "2026-07-01T00:02:00Z",
    };
    expect(receipt.admission_decision).toBe("admit_with_scope");
    expect(receipt.allowed_scopes).toContain("base120:export");
  });
});
