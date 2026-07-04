/**
 * MCP Tool Admission Receipt v0.1
 *
 * Receipt for admitting an MCP tool into agent use.
 * Admission is scoped and revocable, not permanent trust.
 */

export interface McpToolAdmissionReceipt {
  schema_version: string;
  receipt_id: string;
  tool_name: string;
  server_name: string;
  version_or_ref: string;
  owner: string;
  transport: "stdio" | "http" | "sse" | "websocket" | "custom";
  authentication_required: boolean;
  authorization_model: string;
  command_surface: string[];
  network_access: "none" | "outbound" | "inbound" | "bidirectional";
  filesystem_access: "none" | "read" | "write" | "read_write";
  secret_access: "none" | "read" | "write" | "read_write";
  sandbox_posture: "isolated" | "containerized" | "host" | "unknown";
  logging_and_receipts: boolean;
  revocation_path: string;
  known_risks: string[];
  allowed_scopes: string[];
  disabled_by_default_commands: string[];
  admission_decision: "admit" | "admit_with_scope" | "quarantine" | "reject" | "unknown";
  reviewer: string;
  evidence_pointers: string[];
  do_not_infer: string[];
  timestamp: string;
}
