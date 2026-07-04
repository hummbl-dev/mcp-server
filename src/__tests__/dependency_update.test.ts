import { describe, it, expect } from "vitest";
import type { DependencyUpdateReceipt } from "../types/dependency_update.js";

describe("DependencyUpdateReceipt", () => {
  it("should accept a merge recommendation", () => {
    const receipt: DependencyUpdateReceipt = {
      schema_version: "0.1.0-candidate",
      receipt_id: "dep-001",
      package_name: "@cloudflare/workers-types",
      current_version: "4.20250620.0",
      target_version: "4.20250627.0",
      update_source: "dependabot",
      security_fix_claimed: false,
      security_source: null,
      runtime_surface: "dev_dependency",
      breaking_change_risk: "low",
      tests_required: true,
      tests_observed: "passed",
      review_owner: "operator",
      merge_recommendation: "merge",
      residual_risk: ["type definitions may not match runtime exactly"],
      evidence_pointers: ["package.json"],
      do_not_infer: ["merge recommendation is advisory"],
      timestamp: "2026-07-01T00:00:00Z",
    };
    expect(receipt.merge_recommendation).toBe("merge");
    expect(receipt.security_source).toBeNull();
  });

  it("should accept a hold recommendation with security claim", () => {
    const receipt: DependencyUpdateReceipt = {
      schema_version: "0.1.0-candidate",
      receipt_id: "dep-002",
      package_name: "hono",
      current_version: "4.7.0",
      target_version: "4.8.0",
      update_source: "dependabot",
      security_fix_claimed: true,
      security_source: "https://github.com/honojs/hono/security/advisories/GHSA-xxxx",
      runtime_surface: "runtime_dependency",
      breaking_change_risk: "medium",
      tests_required: true,
      tests_observed: "not_run",
      review_owner: "operator",
      merge_recommendation: "hold",
      residual_risk: ["tests not yet run"],
      evidence_pointers: ["package.json"],
      do_not_infer: ["security_fix_claimed does not mean verified"],
      timestamp: "2026-07-01T00:01:00Z",
    };
    expect(receipt.merge_recommendation).toBe("hold");
    expect(receipt.security_fix_claimed).toBe(true);
  });

  it("should accept a quarantine recommendation with unknown fields", () => {
    const receipt: DependencyUpdateReceipt = {
      schema_version: "0.1.0-candidate",
      receipt_id: "dep-003",
      package_name: "unknown-package",
      current_version: "1.0.0",
      target_version: "2.0.0",
      update_source: "unknown",
      security_fix_claimed: false,
      security_source: null,
      runtime_surface: "unknown",
      breaking_change_risk: "unknown",
      tests_required: true,
      tests_observed: "unknown",
      review_owner: "operator",
      merge_recommendation: "quarantine",
      residual_risk: ["unknown source"],
      evidence_pointers: [],
      do_not_infer: ["quarantine means unknown, not rejected"],
      timestamp: "2026-07-01T00:02:00Z",
    };
    expect(receipt.merge_recommendation).toBe("quarantine");
    expect(receipt.runtime_surface).toBe("unknown");
  });
});
