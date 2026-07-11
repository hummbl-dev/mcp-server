/**
 * Dependency Update Receipt v0.1
 *
 * Receipt for risk-ranking dependency update churn.
 * Evidence-bounded — does not merge or block by itself.
 */

export interface DependencyUpdateReceipt {
  schema_version: string;
  receipt_id: string;
  package_name: string;
  current_version: string;
  target_version: string;
  update_source: "dependabot" | "renovate" | "manual" | "security_advisory" | "unknown";
  security_fix_claimed: boolean;
  security_source: string | null;
  runtime_surface:
    | "dev_dependency"
    | "runtime_dependency"
    | "build_tool"
    | "type_definition"
    | "unknown";
  breaking_change_risk: "low" | "medium" | "high" | "unknown";
  tests_required: boolean;
  tests_observed: "passed" | "failed" | "not_run" | "unknown";
  review_owner: string;
  merge_recommendation: "merge" | "hold" | "quarantine" | "unknown";
  residual_risk: string[];
  evidence_pointers: string[];
  do_not_infer: string[];
  timestamp: string;
}
