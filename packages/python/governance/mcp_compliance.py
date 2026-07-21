#!/usr/bin/env python3
# Copyright 2024-2026 HUMMBL, LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# SPDX-License-Identifier: Apache-2.0

"""MCP Server for Compliance Evidence generation.

Packages hummbl-governance compliance capabilities into a focused MCP server
for generating compliance evidence, NIST/SOC2/ISO crosswalks, and STRIDE
threat analysis.

Zero third-party dependencies. Uses only Python stdlib + hummbl_governance.

Usage:
    python3 mcp_compliance.py

Configure in Claude Code settings.json:
    {
      "mcpServers": {
        "hummbl-compliance": {
          "command": "python3",
          "args": ["path/to/mcp_compliance.py"],
          "env": {
            "GOVERNANCE_AUDIT_DIR": "/path/to/audit"
          }
        }
      }
    }

Environment variables:
    GOVERNANCE_AUDIT_DIR  - Audit log JSONL directory (default: system temp dir, e.g. /tmp/governance/audit on Linux)
"""

import json
import os
import sys
import tempfile
import traceback
from datetime import datetime, timezone
from pathlib import Path

from hummbl_governance import ComplianceMapper
from hummbl_governance.stride_mapper import (
    StrideMapper,
    Interaction,
)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
AUDIT_DIR = os.environ.get("GOVERNANCE_AUDIT_DIR", os.path.join(tempfile.gettempdir(), "governance", "audit"))

SERVER_NAME = "hummbl-compliance"
SERVER_VERSION = "0.1.0"
PROTOCOL_VERSION = "2024-11-05"

# ---------------------------------------------------------------------------
# Framework control definitions
# ---------------------------------------------------------------------------

# NIST CSF 2.0 categories with descriptions
NIST_CSF_CONTROLS = {
    "GV": {"name": "Govern", "subcategories": {
        "GV.OC": "Organizational Context",
        "GV.RM": "Risk Management Strategy",
        "GV.RR": "Roles, Responsibilities, and Authorities",
        "GV.PO": "Policy",
        "GV.SC": "Supply Chain Risk Management",
    }},
    "ID": {"name": "Identify", "subcategories": {
        "ID.AM": "Asset Management",
        "ID.RA": "Risk Assessment",
        "ID.IM": "Improvement",
    }},
    "PR": {"name": "Protect", "subcategories": {
        "PR.AA": "Identity Management, Authentication, and Access Control",
        "PR.AT": "Awareness and Training",
        "PR.DS": "Data Security",
        "PR.PS": "Platform Security",
        "PR.IR": "Technology Infrastructure Resilience",
    }},
    "DE": {"name": "Detect", "subcategories": {
        "DE.CM": "Continuous Monitoring",
        "DE.AE": "Adverse Event Analysis",
    }},
    "RS": {"name": "Respond", "subcategories": {
        "RS.MA": "Incident Management",
        "RS.AN": "Incident Analysis",
        "RS.CO": "Incident Response Reporting and Communication",
        "RS.MI": "Incident Mitigation",
    }},
    "RC": {"name": "Recover", "subcategories": {
        "RC.RP": "Incident Recovery Plan Execution",
        "RC.CO": "Incident Recovery Communication",
    }},
}

# NIST AI RMF categories
NIST_AI_RMF_CONTROLS = {
    "GOVERN": {"name": "Govern", "subcategories": {
        "GOVERN-1": "Policies for AI risk management",
        "GOVERN-2": "Accountability structures",
        "GOVERN-3": "Workforce diversity and culture",
        "GOVERN-4": "Organizational practices and culture",
        "GOVERN-5": "Processes for ongoing monitoring",
        "GOVERN-6": "Stakeholder engagement",
    }},
    "MAP": {"name": "Map", "subcategories": {
        "MAP-1": "Context and usage scope",
        "MAP-2": "Categorization of AI system",
        "MAP-3": "Benefits and costs",
        "MAP-5": "Impacts to individuals and communities",
    }},
    "MEASURE": {"name": "Measure", "subcategories": {
        "MEASURE-1": "Appropriate methods and metrics",
        "MEASURE-2": "AI systems evaluated for trustworthiness",
        "MEASURE-3": "Mechanisms for tracking metrics",
        "MEASURE-4": "Feedback mechanisms",
    }},
    "MANAGE": {"name": "Manage", "subcategories": {
        "MANAGE-1": "AI risks are prioritized and acted upon",
        "MANAGE-2": "Strategies to maximize AI benefits",
        "MANAGE-3": "AI risks and benefits from third-party entities managed",
        "MANAGE-4": "Risk treatments documented and monitored",
    }},
}

# SOC 2 Trust Service Criteria
SOC2_CRITERIA = {
    "Security": {
        "CC1": "Control Environment",
        "CC2": "Communication and Information",
        "CC3": "Risk Assessment",
        "CC4": "Monitoring Activities",
        "CC5": "Control Activities",
        "CC6": "Logical and Physical Access Controls",
        "CC7": "System Operations",
        "CC8": "Change Management",
        "CC9": "Risk Mitigation",
    },
    "Availability": {
        "A1": "Availability Commitments and System Requirements",
    },
    "Processing Integrity": {
        "PI1": "Processing Integrity Commitments and System Requirements",
    },
    "Confidentiality": {
        "C1": "Confidentiality Commitments and System Requirements",
    },
    "Privacy": {
        "P1": "Privacy Commitments and System Requirements",
    },
}

# ISO crosswalk mapping: ISO control -> equivalent controls in other frameworks
ISO_CROSSWALK = {
    "ISO27001:A.5": {"nist_csf": "GV.PO", "soc2": "CC1", "description": "Information security policies"},
    "ISO27001:A.6": {"nist_csf": "GV.RR", "soc2": "CC1", "description": "Organization of information security"},
    "ISO27001:A.7": {"nist_csf": "PR.AT", "soc2": "CC1", "description": "Human resource security"},
    "ISO27001:A.8": {"nist_csf": "ID.AM", "soc2": "CC6", "description": "Asset management"},
    "ISO27001:A.9": {"nist_csf": "PR.AA", "soc2": "CC6", "description": "Access control"},
    "ISO27001:A.10": {"nist_csf": "PR.DS", "soc2": "CC6", "description": "Cryptography"},
    "ISO27001:A.12": {"nist_csf": "PR.PS", "soc2": "CC7", "description": "Operations security"},
    "ISO27001:A.13": {"nist_csf": "PR.DS", "soc2": "CC6", "description": "Communications security"},
    "ISO27001:A.14": {
        "nist_csf": "PR.PS", "soc2": "CC8",
        "description": "System acquisition, development, maintenance",
    },
    "ISO27001:A.16": {"nist_csf": "RS.MA", "soc2": "CC7", "description": "Information security incident management"},
    "ISO27001:A.17": {"nist_csf": "PR.IR", "soc2": "A1", "description": "Business continuity"},
    "ISO27001:A.18": {"nist_csf": "GV.PO", "soc2": "CC2", "description": "Compliance"},
    "ISO42001:5": {"nist_ai_rmf": "GOVERN-1", "soc2": "CC1", "description": "AI leadership and commitment"},
    "ISO42001:6": {"nist_ai_rmf": "MAP-1", "soc2": "CC3", "description": "AI planning and risk"},
    "ISO42001:7": {"nist_ai_rmf": "GOVERN-3", "soc2": "CC1", "description": "AI support and resources"},
    "ISO42001:8": {"nist_ai_rmf": "MANAGE-1", "soc2": "CC5", "description": "AI operation"},
    "ISO42001:9": {"nist_ai_rmf": "MEASURE-1", "soc2": "CC4", "description": "AI performance evaluation"},
    "ISO42001:10": {"nist_ai_rmf": "MANAGE-4", "soc2": "CC4", "description": "AI improvement"},
}


# ---------------------------------------------------------------------------
# Governance tuple -> framework control mapping
# ---------------------------------------------------------------------------

# Which governance tuple types map to which NIST CSF subcategories
_TUPLE_TO_NIST_CSF = {
    "DCT": ["PR.AA", "PR.DS"],
    "DCTX": ["PR.AA", "DE.CM"],
    "CONTRACT": ["GV.PO", "GV.RR"],
    "INTENT": ["GV.OC", "ID.RA"],
    "EVIDENCE": ["DE.CM", "DE.AE"],
    "ATTEST": ["DE.CM", "RS.AN"],
    "CIRCUIT_BREAKER": ["PR.IR", "RS.MI"],
    "KILLSWITCH": ["RS.MA", "RS.MI"],
    "SYSTEM": ["DE.CM"],
}

# Which governance tuple types map to which NIST AI RMF subcategories
_TUPLE_TO_AI_RMF = {
    "INTENT": ["GOVERN-1", "MAP-1"],
    "CONTRACT": ["GOVERN-2", "GOVERN-4"],
    "DCT": ["GOVERN-5", "MANAGE-1"],
    "DCTX": ["GOVERN-5", "MANAGE-3"],
    "EVIDENCE": ["MEASURE-1", "MEASURE-2"],
    "ATTEST": ["MEASURE-3", "MEASURE-4"],
    "CIRCUIT_BREAKER": ["MANAGE-1", "MANAGE-4"],
    "KILLSWITCH": ["MANAGE-1", "MANAGE-4"],
}

# Which governance tuple types map to which SOC 2 criteria
_TUPLE_TO_SOC2 = {
    "DCT": ["CC6.1", "CC6.3"],
    "DCTX": ["CC6.1", "CC7.2"],
    "CONTRACT": ["CC1.1", "CC5.1"],
    "INTENT": ["CC3.1", "CC3.2"],
    "EVIDENCE": ["CC4.1", "CC7.2"],
    "ATTEST": ["CC4.1", "CC4.2"],
    "CIRCUIT_BREAKER": ["CC7.2", "CC9.1", "A1.1"],
    "KILLSWITCH": ["CC7.2", "CC9.1", "A1.1"],
    "SYSTEM": ["CC7.2"],
}


# ---------------------------------------------------------------------------
# Helper: read governance entries from a directory
# ---------------------------------------------------------------------------
def _read_governance_entries(governance_dir: str) -> list[dict]:
    """Read all governance JSONL entries from the specified directory."""
    gdir = Path(governance_dir)
    if not gdir.exists():
        return []

    entries = []
    for fpath in sorted(gdir.glob("governance-*.jsonl")):
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
        except (IOError, OSError):
            continue
    return entries


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------
def _build_coverage_map(controls_dict, tuple_mapping, entries):
    """Build a coverage map from entries using a tuple-to-control mapping."""
    coverage: dict[str, list[dict]] = {}
    for subcat_id in [sc for func in controls_dict.values() for sc in func["subcategories"]]:
        coverage[subcat_id] = []

    for entry in entries:
        tuple_type = entry.get("tuple_type", "")
        base = {
            "entry_id": entry.get("entry_id"),
            "timestamp": entry.get("timestamp"),
            "tuple_type": tuple_type,
        }
        for sub in tuple_mapping.get(tuple_type, []):
            if sub in coverage:
                coverage[sub].append(base.copy())

    return coverage


def _coverage_summary(coverage):
    """Compute coverage stats from a coverage map."""
    total = len(coverage)
    covered = sum(1 for v in coverage.values() if v)
    gaps = [k for k, v in coverage.items() if not v]
    return {
        "coverage": f"{covered}/{total}",
        "coverage_pct": round(covered / total * 100, 1) if total else 0,
        "controls": {k: {"evidence_count": len(v)} for k, v in coverage.items()},
        "gaps": gaps,
    }


def _nist_map_controls(governance_dir: str) -> dict:
    """Map governance evidence to NIST CSF 2.0 and AI RMF categories."""
    entries = _read_governance_entries(governance_dir)

    csf_coverage = _build_coverage_map(NIST_CSF_CONTROLS, _TUPLE_TO_NIST_CSF, entries)
    ai_rmf_coverage = _build_coverage_map(NIST_AI_RMF_CONTROLS, _TUPLE_TO_AI_RMF, entries)

    return {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "governance_dir": governance_dir,
        "entries_analyzed": len(entries),
        "nist_csf_2_0": _coverage_summary(csf_coverage),
        "nist_ai_rmf": _coverage_summary(ai_rmf_coverage),
    }


def _map_entries_to_soc2(entries):
    """Map governance entries to SOC 2 criteria evidence."""
    criteria_evidence: dict[str, dict[str, list]] = {}
    for category, criteria in SOC2_CRITERIA.items():
        criteria_evidence[category] = {crit_id: [] for crit_id in criteria}

    for entry in entries:
        tuple_type = entry.get("tuple_type", "")
        base = {
            "entry_id": entry.get("entry_id"),
            "timestamp": entry.get("timestamp"),
            "tuple_type": tuple_type,
        }
        for soc2_ctrl in _TUPLE_TO_SOC2.get(tuple_type, []):
            ctrl_prefix = soc2_ctrl.split(".")[0]
            for category, criteria in SOC2_CRITERIA.items():
                if ctrl_prefix in criteria:
                    if ctrl_prefix not in criteria_evidence[category]:
                        criteria_evidence[category][ctrl_prefix] = []
                    criteria_evidence[category][ctrl_prefix].append(base.copy())
    return criteria_evidence


def _readiness_label(pct):
    """Convert coverage percentage to readiness label."""
    if pct >= 80:
        return "READY"
    if pct >= 50:
        return "PARTIAL"
    return "GAP"


def _score_criteria(criteria_evidence):
    """Score each trust service category."""
    scores: dict[str, dict] = {}
    for category, criteria in criteria_evidence.items():
        total_criteria = len(SOC2_CRITERIA[category])
        covered = sum(1 for v in criteria.values() if v)
        pct = round(covered / total_criteria * 100, 1) if total_criteria else 0
        scores[category] = {
            "coverage_pct": pct,
            "readiness": _readiness_label(pct),
            "criteria_covered": covered,
            "criteria_total": total_criteria,
            "evidence_counts": {k: len(v) for k, v in criteria.items()},
        }
    return scores


def _soc2_assess(governance_dir: str) -> dict:
    """SOC 2 Type II readiness assessment."""
    entries = _read_governance_entries(governance_dir)
    criteria_evidence = _map_entries_to_soc2(entries)

    mapper = ComplianceMapper(governance_dir=Path(governance_dir))
    soc2_report = mapper.generate_soc2_report(days=90)

    scores = _score_criteria(criteria_evidence)
    all_pcts = [s["coverage_pct"] for s in scores.values()]
    overall_pct = round(sum(all_pcts) / len(all_pcts), 1) if all_pcts else 0

    return {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "governance_dir": governance_dir,
        "entries_analyzed": len(entries),
        "overall_readiness_pct": overall_pct,
        "overall_readiness": _readiness_label(overall_pct),
        "trust_service_criteria": scores,
        "soc2_control_evidence": {
            "CC6.1_evidence": len(soc2_report.controls.get("CC6.1", [])),
            "CC6.3_evidence": len(soc2_report.controls.get("CC6.3", [])),
            "CC7.2_evidence": len(soc2_report.controls.get("CC7.2", [])),
        },
    }


def _iso_crosswalk(governance_dir: str) -> dict:
    """Cross-reference controls across ISO 27001, ISO 42001, NIST CSF, SOC 2."""
    entries = _read_governance_entries(governance_dir)

    # Determine which controls have evidence
    nist_result = _nist_map_controls(governance_dir)
    csf_controls = nist_result["nist_csf_2_0"]["controls"]
    ai_rmf_controls = nist_result["nist_ai_rmf"]["controls"]

    # Build the crosswalk table
    crosswalk_table = []
    iso_covered = 0
    iso_total = len(ISO_CROSSWALK)

    for iso_ctrl, mapping in ISO_CROSSWALK.items():
        nist_csf_id = mapping.get("nist_csf")
        nist_ai_rmf_id = mapping.get("nist_ai_rmf")
        soc2_id = mapping.get("soc2")

        csf_count = csf_controls.get(nist_csf_id, {}).get("evidence_count", 0) if nist_csf_id else 0
        rmf_count = ai_rmf_controls.get(nist_ai_rmf_id, {}).get("evidence_count", 0) if nist_ai_rmf_id else 0

        has_evidence = csf_count > 0 or rmf_count > 0
        if has_evidence:
            iso_covered += 1

        crosswalk_table.append({
            "iso_control": iso_ctrl,
            "description": mapping["description"],
            "nist_csf": nist_csf_id,
            "nist_ai_rmf": nist_ai_rmf_id,
            "soc2": soc2_id,
            "csf_evidence_count": csf_count,
            "ai_rmf_evidence_count": rmf_count,
            "has_evidence": has_evidence,
        })

    return {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "governance_dir": governance_dir,
        "entries_analyzed": len(entries),
        "frameworks": ["ISO 27001", "ISO 42001", "NIST CSF 2.0", "NIST AI RMF", "SOC 2"],
        "coverage": {
            "iso_controls_covered": iso_covered,
            "iso_controls_total": iso_total,
            "iso_coverage_pct": round(iso_covered / iso_total * 100, 1) if iso_total else 0,
            "nist_csf_coverage_pct": nist_result["nist_csf_2_0"]["coverage_pct"],
            "nist_ai_rmf_coverage_pct": nist_result["nist_ai_rmf"]["coverage_pct"],
        },
        "crosswalk": crosswalk_table,
    }


def _stride_analysis(interactions_raw: list[dict]) -> dict:
    """Run STRIDE threat analysis on agent interactions."""
    mapper = StrideMapper()

    interactions = []
    for raw in interactions_raw:
        # Map the input schema to Interaction fields
        auth_level = raw.get("auth_level", "none")
        interactions.append(Interaction(
            source=raw.get("source", "unknown"),
            target=raw.get("target", "unknown"),
            action=raw.get("data_type", "read"),
            trust_boundary=raw.get("boundary", False),
            authenticated=auth_level in ("authenticated", "mTLS", "token", "hmac"),
            encrypted=auth_level in ("mTLS", "encrypted"),
            has_delegation_token=auth_level in ("token", "hmac"),
            has_audit_trail=raw.get("audited", False),
            has_rate_limit=raw.get("rate_limited", False),
        ))

    report = mapper.generate_report(interactions)
    result = report.to_dict()

    # Add severity breakdown
    severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for finding in report.findings:
        severity_counts[finding.risk_level.value] += 1
    result["by_severity"] = severity_counts

    return result


def _report_to_evidence(report):
    """Convert a compliance report to evidence dict."""
    return {
        "framework": report.framework,
        "generated_at": report.generated_at,
        "controls": report.controls,
        "summary": {ctrl: len(evs) for ctrl, evs in report.controls.items()},
    }


def _count_evidence_items(evidence):
    """Sum evidence items across all frameworks."""
    total = 0
    for fw_data in evidence.values():
        if "summary" in fw_data:
            total += sum(fw_data["summary"].values())
        elif "entries_analyzed" in fw_data:
            total += fw_data["entries_analyzed"]
    return total


def _compliance_evidence_export(governance_dir: str, framework: str) -> dict:
    """Export compliance evidence package for auditors."""
    mapper = ComplianceMapper(governance_dir=Path(governance_dir))
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    evidence: dict = {}

    if framework in ("soc2", "all"):
        evidence["soc2"] = _report_to_evidence(mapper.generate_soc2_report(days=90))

    if framework in ("nist", "all"):
        evidence["nist"] = _nist_map_controls(governance_dir)

    if framework in ("iso", "all"):
        evidence["iso_crosswalk"] = _iso_crosswalk(governance_dir)

    if framework in ("owasp", "all"):
        evidence["owasp_agentic"] = _report_to_evidence(mapper.generate_owasp_report(days=90))

    if framework == "all":
        evidence["gdpr"] = _report_to_evidence(mapper.generate_gdpr_report(days=90))

    return {
        "generated_at": now,
        "governance_dir": governance_dir,
        "export_framework": framework,
        "evidence": evidence,
        "total_evidence_items": _count_evidence_items(evidence),
    }


# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------
TOOLS = [
    {
        "name": "nist_map_controls",
        "description": (
            "Map governance evidence to NIST CSF 2.0 and AI RMF categories. "
            "Reads governance JSONL audit logs and maps each tuple type to the "
            "relevant NIST subcategories, returning coverage percentages and gaps."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "governance_dir": {
                    "type": "string",
                    "description": "Path to directory containing governance-*.jsonl audit logs",
                },
            },
            "required": ["governance_dir"],
        },
    },
    {
        "name": "soc2_assess",
        "description": (
            "SOC 2 Type II readiness assessment. Scores governance evidence against "
            "all five trust service criteria: Security, Availability, Processing "
            "Integrity, Confidentiality, and Privacy. Returns per-criteria readiness."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "governance_dir": {
                    "type": "string",
                    "description": "Path to directory containing governance-*.jsonl audit logs",
                },
            },
            "required": ["governance_dir"],
        },
    },
    {
        "name": "iso_crosswalk",
        "description": (
            "Cross-reference controls across ISO 27001, ISO 42001, NIST CSF 2.0, "
            "NIST AI RMF, and SOC 2. Returns a mapping table showing which controls "
            "have governance evidence and coverage percentages per framework."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "governance_dir": {
                    "type": "string",
                    "description": "Path to directory containing governance-*.jsonl audit logs",
                },
            },
            "required": ["governance_dir"],
        },
    },
    {
        "name": "stride_analysis",
        "description": (
            "Run STRIDE threat analysis on a set of agent interactions. Evaluates "
            "each interaction for Spoofing, Tampering, Repudiation, Information "
            "Disclosure, Denial of Service, and Elevation of Privilege threats."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "interactions": {
                    "type": "array",
                    "description": "List of agent interactions to analyze",
                    "items": {
                        "type": "object",
                        "properties": {
                            "source": {"type": "string", "description": "Source agent or component"},
                            "target": {"type": "string", "description": "Target agent or resource"},
                            "data_type": {
                                "type": "string",
                                "description": "Action/data type (read, write, execute, etc.)",
                            },
                            "auth_level": {
                                "type": "string",
                                "description": "Authentication level (none, authenticated, token, hmac, mTLS)",
                            },
                            "boundary": {"type": "boolean", "description": "Whether this crosses a trust boundary"},
                            "audited": {
                                "type": "boolean",
                                "description": "Whether this interaction has an audit trail",
                            },
                            "rate_limited": {"type": "boolean", "description": "Whether rate limiting is in place"},
                        },
                        "required": ["source", "target"],
                    },
                },
            },
            "required": ["interactions"],
        },
    },
    {
        "name": "compliance_evidence_export",
        "description": (
            "Export a complete compliance evidence package as structured JSON for "
            "auditors. Combines evidence from all governance primitives mapped to "
            "the selected framework(s)."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "governance_dir": {
                    "type": "string",
                    "description": "Path to directory containing governance-*.jsonl audit logs",
                },
                "framework": {
                    "type": "string",
                    "enum": ["soc2", "nist", "iso", "owasp", "all"],
                    "description": "Compliance framework to export evidence for (default: all)",
                    "default": "all",
                },
            },
            "required": ["governance_dir"],
        },
    },
]


# ---------------------------------------------------------------------------
# Tool dispatch
# ---------------------------------------------------------------------------
def handle_tool(name: str, arguments: dict) -> dict:
    """Dispatch a tool call to the appropriate handler."""

    if name == "nist_map_controls":
        return _nist_map_controls(arguments["governance_dir"])

    elif name == "soc2_assess":
        return _soc2_assess(arguments["governance_dir"])

    elif name == "iso_crosswalk":
        return _iso_crosswalk(arguments["governance_dir"])

    elif name == "stride_analysis":
        return _stride_analysis(arguments.get("interactions", []))

    elif name == "compliance_evidence_export":
        return _compliance_evidence_export(
            arguments["governance_dir"],
            arguments.get("framework", "all"),
        )

    else:
        return {"error": f"Unknown tool: {name}"}


# ---------------------------------------------------------------------------
# JSON-RPC protocol
# ---------------------------------------------------------------------------
def send_response(msg_id, result):
    """Send a JSON-RPC response to stdout."""
    response = {"jsonrpc": "2.0", "id": msg_id, "result": result}
    out = json.dumps(response)
    sys.stdout.write(out + "\n")
    sys.stdout.flush()


def send_error(msg_id, code, message):
    """Send a JSON-RPC error to stdout."""
    response = {
        "jsonrpc": "2.0",
        "id": msg_id,
        "error": {"code": code, "message": message},
    }
    out = json.dumps(response)
    sys.stdout.write(out + "\n")
    sys.stdout.flush()


def main():
    """Main stdio JSON-RPC loop implementing MCP protocol."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue

        msg_id = msg.get("id")
        method = msg.get("method", "")
        params = msg.get("params", {})

        try:
            if method == "initialize":
                send_response(msg_id, {
                    "protocolVersion": PROTOCOL_VERSION,
                    "capabilities": {"tools": {}},
                    "serverInfo": {
                        "name": SERVER_NAME,
                        "version": SERVER_VERSION,
                    },
                })

            elif method == "notifications/initialized":
                pass

            elif method == "tools/list":
                send_response(msg_id, {"tools": TOOLS})

            elif method == "tools/call":
                tool_name = params.get("name", "")
                arguments = params.get("arguments", {})
                result = handle_tool(tool_name, arguments)
                send_response(msg_id, {
                    "content": [
                        {"type": "text", "text": json.dumps(result, indent=2, default=str)}
                    ],
                })

            elif method == "ping":
                send_response(msg_id, {})

            else:
                send_error(msg_id, -32601, f"Method not found: {method}")

        except Exception as e:
            send_error(
                msg_id,
                -32603,
                f"Internal error: {e}\n{traceback.format_exc()}",
            )


if __name__ == "__main__":
    main()
