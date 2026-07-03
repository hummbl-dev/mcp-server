#!/usr/bin/env python3
"""Validate dependency update receipts.

Ensures security fix claims have sources, test requirements are met, and
merge recommendations are consistent with risk levels.

Default mode is warning-only. Use --strict to fail on violations.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

VALID_UPDATE_SOURCES = {"dependabot", "renovate", "manual", "security_advisory", "npm_audit", "other"}
VALID_RUNTIME_SURFACES = {"dev_dependency", "runtime_dependency", "build_tool", "type_definition", "test_dependency", "config_dependency"}
VALID_BREAKING_RISKS = {"none", "low", "medium", "high", "critical"}
VALID_TEST_STATUSES = {"passed", "failed", "skipped", "not_run"}
VALID_RECOMMENDATIONS = {"merge", "hold", "quarantine", "unknown"}


def _v(gate: str, msg: str, severity: str = "error") -> dict[str, str]:
    return {"gate": gate, "message": msg, "severity": severity}


def validate_dep_update(payload: dict[str, Any]) -> dict[str, Any]:
    violations: list[dict[str, str]] = []

    required = (
        "schema_version", "receipt_id", "package_name", "current_version",
        "target_version", "update_source", "security_fix_claimed",
        "runtime_surface", "breaking_change_risk", "tests_required",
        "tests_observed", "review_owner", "merge_recommendation",
        "residual_risk", "do_not_infer", "evaluated_at",
    )
    for field in required:
        if field not in payload:
            violations.append(_v("G-SCHEMA-VALID", f"missing required field: {field}"))

    # G-UPDATE-SOURCE-VALID
    if payload.get("update_source") not in VALID_UPDATE_SOURCES and "update_source" in payload:
        violations.append(_v("G-UPDATE-SOURCE-VALID", f"invalid update_source: {payload.get('update_source')}"))

    # G-RUNTIME-SURFACE-VALID
    if payload.get("runtime_surface") not in VALID_RUNTIME_SURFACES and "runtime_surface" in payload:
        violations.append(_v("G-RUNTIME-SURFACE-VALID", f"invalid runtime_surface: {payload.get('runtime_surface')}"))

    # G-BREAKING-RISK-VALID
    if payload.get("breaking_change_risk") not in VALID_BREAKING_RISKS and "breaking_change_risk" in payload:
        violations.append(_v("G-BREAKING-RISK-VALID", f"invalid breaking_change_risk: {payload.get('breaking_change_risk')}"))

    # G-SECURITY-SOURCE-REQUIRED
    if payload.get("security_fix_claimed") and not payload.get("security_source"):
        violations.append(_v("G-SECURITY-SOURCE-REQUIRED", "security_fix_claimed=true but security_source is null or missing"))

    # G-MERGE-RECOMMENDATION-VALID
    rec = payload.get("merge_recommendation")
    if rec not in VALID_RECOMMENDATIONS and "merge_recommendation" in payload:
        violations.append(_v("G-MERGE-RECOMMENDATION-VALID", f"invalid merge_recommendation: {rec}"))

    # G-TEST-CONSISTENCY
    tests_required = payload.get("tests_required")
    tests_observed = payload.get("tests_observed", {})
    if isinstance(tests_observed, dict):
        test_status = tests_observed.get("status")
        if test_status not in VALID_TEST_STATUSES and "status" in tests_observed:
            violations.append(_v("G-TEST-STATUS-VALID", f"invalid tests_observed.status: {test_status}"))
        if tests_required and test_status == "not_run":
            violations.append(_v("G-TEST-CONSISTENCY", "tests_required=true but tests were not run"))
        if tests_required and test_status == "skipped":
            violations.append(_v("G-TEST-CONSISTENCY", "tests_required=true but tests were skipped"))

    # G-HIGH-RISK-REQUIRES-HOLD-OR-QUARANTINE
    risk = payload.get("breaking_change_risk")
    if risk in {"high", "critical"} and rec == "merge":
        violations.append(_v("G-HIGH-RISK-REQUIRES-HOLD-OR-QUARANTINE", f"breaking_change_risk '{risk}' but merge_recommendation is merge — must hold or quarantine"))

    # G-DO-NOT-INFER-PRESENT
    do_not_infer = payload.get("do_not_infer", [])
    if not isinstance(do_not_infer, list) or len(do_not_infer) == 0:
        violations.append(_v("G-DO-NOT-INFER-PRESENT", "do_not_infer must have at least one boundary"))

    # G-RESIDUAL-RISK-REQUIRED
    if not payload.get("residual_risk"):
        violations.append(_v("G-RESIDUAL-RISK-REQUIRED", "residual_risk must be a non-empty string"))

    errors = [v for v in violations if v["severity"] == "error"]
    return {"valid": len(errors) == 0, "error_count": len(errors), "warning_count": 0, "violations": violations}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("receipt_path", help="Path to a dependency update receipt JSON file")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero on errors")
    args = parser.parse_args(argv)

    with Path(args.receipt_path).open("r", encoding="utf-8") as f:
        payload = json.load(f)

    result = validate_dep_update(payload)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 1 if args.strict and not result["valid"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
