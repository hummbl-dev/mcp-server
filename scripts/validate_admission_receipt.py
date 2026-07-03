#!/usr/bin/env python3
"""Validate MCP tool admission receipts.

Ensures required fields, valid enums, and security posture consistency.

Default mode is warning-only. Use --strict to fail on violations.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

VALID_TRANSPORTS = {"stdio", "http", "websocket", "sse", "cloudflare_worker"}
VALID_AUTH_MODELS = {"none", "token", "oauth", "mtls", "api_key", "session"}
VALID_NETWORK_LEVELS = {"none", "loopback", "internal", "external", "unrestricted"}
VALID_FS_LEVELS = {"none", "read_only", "read_write", "unrestricted"}
VALID_SECRET_LEVELS = {"none", "env_only", "secret_manager", "unrestricted"}
VALID_SANDBOX = {"none", "container", "vm", "wasm", "worker", "subprocess"}
VALID_DECISIONS = {"admit", "admit_with_scope", "quarantine", "reject"}
VALID_SEVERITY = {"low", "medium", "high", "critical"}


def _v(gate: str, msg: str, severity: str = "error") -> dict[str, str]:
    return {"gate": gate, "message": msg, "severity": severity}


def validate_admission_receipt(payload: dict[str, Any]) -> dict[str, Any]:
    violations: list[dict[str, str]] = []

    required = (
        "schema_version", "receipt_id", "tool_name", "server_name", "version_or_ref",
        "owner", "transport", "authentication_required", "authorization_model",
        "command_surface", "network_access", "filesystem_access", "secret_access",
        "sandbox_posture", "logging_and_receipts", "revocation_path",
        "known_risks", "allowed_scopes", "disabled_by_default_commands",
        "admission_decision", "evaluated_at",
    )
    for field in required:
        if field not in payload:
            violations.append(_v("G-SCHEMA-VALID", f"missing required field: {field}"))

    # G-TRANSPORT-VALID
    if payload.get("transport") not in VALID_TRANSPORTS and "transport" in payload:
        violations.append(_v("G-TRANSPORT-VALID", f"invalid transport: {payload.get('transport')}"))

    # G-AUTH-MODEL-VALID
    if payload.get("authorization_model") not in VALID_AUTH_MODELS and "authorization_model" in payload:
        violations.append(_v("G-AUTH-MODEL-VALID", f"invalid authorization_model: {payload.get('authorization_model')}"))

    # G-NETWORK-LEVEL-VALID
    net = payload.get("network_access", {})
    if isinstance(net, dict) and net.get("level") not in VALID_NETWORK_LEVELS and "level" in net:
        violations.append(_v("G-NETWORK-LEVEL-VALID", f"invalid network_access.level: {net.get('level')}"))

    # G-FS-LEVEL-VALID
    fs = payload.get("filesystem_access", {})
    if isinstance(fs, dict) and fs.get("level") not in VALID_FS_LEVELS and "level" in fs:
        violations.append(_v("G-FS-LEVEL-VALID", f"invalid filesystem_access.level: {fs.get('level')}"))

    # G-SECRET-LEVEL-VALID
    sec = payload.get("secret_access", {})
    if isinstance(sec, dict) and sec.get("level") not in VALID_SECRET_LEVELS and "level" in sec:
        violations.append(_v("G-SECRET-LEVEL-VALID", f"invalid secret_access.level: {sec.get('level')}"))

    # G-SANDBOX-VALID
    if payload.get("sandbox_posture") not in VALID_SANDBOX and "sandbox_posture" in payload:
        violations.append(_v("G-SANDBOX-VALID", f"invalid sandbox_posture: {payload.get('sandbox_posture')}"))

    # G-DECISION-VALID
    decision = payload.get("admission_decision")
    if decision not in VALID_DECISIONS and "admission_decision" in payload:
        violations.append(_v("G-DECISION-VALID", f"invalid admission_decision: {decision}"))

    # G-UNRESTRICTED-ACCESS-REQUIRES-SANDBOX
    net_unrestricted = isinstance(net, dict) and net.get("level") == "unrestricted"
    fs_unrestricted = isinstance(fs, dict) and fs.get("level") == "unrestricted"
    sec_unrestricted = isinstance(sec, dict) and sec.get("level") == "unrestricted"
    if (net_unrestricted or fs_unrestricted or sec_unrestricted):
        if payload.get("sandbox_posture") == "none":
            violations.append(_v("G-UNRESTRICTED-ACCESS-REQUIRES-SANDBOX", "unrestricted access level requires non-none sandbox_posture"))

    # G-NO-AUTH-REQUIRES-QUARANTINE-OR-REJECT
    if not payload.get("authentication_required") and decision == "admit":
        violations.append(_v("G-NO-AUTH-REQUIRES-QUARANTINE-OR-REJECT", "authentication_required=false but decision is admit — must quarantine or reject"))

    # G-HIGH-RISK-REQUIRES-QUARANTINE-OR-REJECT
    risks = payload.get("known_risks", [])
    if isinstance(risks, list):
        has_critical = any(isinstance(r, dict) and r.get("severity") == "critical" for r in risks)
        if has_critical and decision == "admit":
            violations.append(_v("G-HIGH-RISK-REQUIRES-QUARANTINE-OR-REJECT", "critical risk present but decision is admit — must quarantine or reject"))

    # G-RISK-SEVERITY-VALID
    if isinstance(risks, list):
        for i, risk in enumerate(risks):
            if isinstance(risk, dict) and risk.get("severity") not in VALID_SEVERITY and "severity" in risk:
                violations.append(_v("G-RISK-SEVERITY-VALID", f"known_risks[{i}] invalid severity: {risk.get('severity')}"))

    errors = [v for v in violations if v["severity"] == "error"]
    return {"valid": len(errors) == 0, "error_count": len(errors), "warning_count": 0, "violations": violations}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("receipt_path", help="Path to an MCP tool admission receipt JSON file")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero on errors")
    args = parser.parse_args(argv)

    with Path(args.receipt_path).open("r", encoding="utf-8") as f:
        payload = json.load(f)

    result = validate_admission_receipt(payload)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 1 if args.strict and not result["valid"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
