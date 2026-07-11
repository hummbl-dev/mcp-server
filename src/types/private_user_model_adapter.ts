/**
 * Boundary-only contract for a future private user-model adapter.
 *
 * This type is deliberately not wired into the public MCP server. Any future
 * implementation must authenticate the caller and enforce consent, visibility,
 * and retention policy before returning private model material.
 */

export interface PrivateUserModelRequest {
  subjectId: string;
  consentReference: string;
  visibilityPolicyReference: string;
}

export interface PrivateUserModelAdapter {
  getPrivateUserModel(request: PrivateUserModelRequest): Promise<unknown>;
}
