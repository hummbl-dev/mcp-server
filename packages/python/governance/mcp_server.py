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

"""MCP Server for hummbl-governance.

Exposes governance primitives (kill switch, circuit breaker, cost governor,
audit log, compliance mapper, health probes) as MCP tools via stdio JSON-RPC.

Zero third-party dependencies. Uses only Python stdlib + hummbl_governance.

Usage:
    python3 mcp_server.py

Configure in Claude Code settings.json:
    {
      "mcpServers": {
        "hummbl-governance": {
          "command": "python3",
          "args": ["path/to/mcp_server.py"],
          "env": {
            "GOVERNANCE_STATE_DIR": "/path/to/state"
          }
        }
      }
    }

Environment variables:
    GOVERNANCE_STATE_DIR  - Kill switch state persistence (default: system temp dir, e.g. /tmp/governance on Linux)
    GOVERNANCE_DB_PATH    - Cost governor SQLite (default: {state_dir}/costs.db)
    GOVERNANCE_AUDIT_DIR  - Audit log JSONL directory (default: {state_dir}/audit)
"""

import json
import os
import sys
import tempfile
import traceback
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Governance imports
# ---------------------------------------------------------------------------
from hummbl_governance import (
    KillSwitch,
    KillSwitchMode,
    CircuitBreaker,
    CostGovernor,
    AuditLog,
    ComplianceMapper,
    HealthCollector,
)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
STATE_DIR = os.environ.get("GOVERNANCE_STATE_DIR", os.path.join(tempfile.gettempdir(), "governance"))
DB_PATH = os.environ.get("GOVERNANCE_DB_PATH", os.path.join(STATE_DIR, "costs.db"))
AUDIT_DIR = os.environ.get("GOVERNANCE_AUDIT_DIR", os.path.join(STATE_DIR, "audit"))

SERVER_NAME = "hummbl-governance"
SERVER_VERSION = "0.1.0"
PROTOCOL_VERSION = "2024-11-05"

# ---------------------------------------------------------------------------
# Singleton governance instances (lazy init)
# ---------------------------------------------------------------------------
_instances = {}


def _ensure_dirs():
    os.makedirs(STATE_DIR, exist_ok=True)
    os.makedirs(AUDIT_DIR, exist_ok=True)


def get_kill_switch():
    if "ks" not in _instances:
        _ensure_dirs()
        _instances["ks"] = KillSwitch(state_dir=Path(STATE_DIR))
    return _instances["ks"]


def get_circuit_breaker():
    if "cb" not in _instances:
        _instances["cb"] = CircuitBreaker(failure_threshold=5, recovery_timeout=60)
    return _instances["cb"]


def get_cost_governor():
    if "cg" not in _instances:
        _ensure_dirs()
        _instances["cg"] = CostGovernor(db_path=DB_PATH)
    return _instances["cg"]


def get_audit_log():
    if "al" not in _instances:
        _ensure_dirs()
        _instances["al"] = AuditLog(base_dir=AUDIT_DIR)
    return _instances["al"]


# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------
TOOLS = [
    {
        "name": "governance_status",
        "description": (
            "Get a one-call overview of all governance primitives:"
            " kill switch mode, circuit breaker state, cost budget status."
        ),
        "inputSchema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "kill_switch_status",
        "description": "Get detailed kill switch state: current mode, engagement history, critical tasks list.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "history_limit": {
                    "type": "integer",
                    "description": "Max history entries to return (default: 5)",
                    "default": 5,
                }
            },
            "required": [],
        },
    },
    {
        "name": "kill_switch_engage",
        "description": "Engage the kill switch. Modes: HALT_NONCRITICAL, HALT_ALL, EMERGENCY. Requires confirm=true.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "mode": {
                    "type": "string",
                    "enum": ["HALT_NONCRITICAL", "HALT_ALL", "EMERGENCY"],
                    "description": "Kill switch engagement mode",
                },
                "reason": {"type": "string", "description": "Reason for engagement"},
                "triggered_by": {"type": "string", "description": "Who triggered this (agent or human ID)"},
                "confirm": {"type": "boolean", "description": "Must be true to engage"},
            },
            "required": ["mode", "reason", "confirm"],
        },
    },
    {
        "name": "kill_switch_disengage",
        "description": "Disengage the kill switch and return to normal operations.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "reason": {"type": "string", "description": "Reason for disengagement"},
                "triggered_by": {"type": "string", "description": "Who triggered this"},
            },
            "required": ["reason"],
        },
    },
    {
        "name": "circuit_breaker_status",
        "description": "Get circuit breaker state: CLOSED (healthy), OPEN (tripped), or HALF_OPEN (testing recovery).",
        "inputSchema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "cost_budget_check",
        "description": (
            "Check current daily spend against budget caps."
            " Returns ALLOW, WARN, or DENY decision with rationale."
        ),
        "inputSchema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "cost_record_usage",
        "description": "Record an API usage event for cost tracking.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "provider": {"type": "string", "description": "API provider (e.g., anthropic, openai)"},
                "model": {"type": "string", "description": "Model name (e.g., claude-opus-4-6)"},
                "tokens_in": {"type": "integer", "description": "Input tokens"},
                "tokens_out": {"type": "integer", "description": "Output tokens"},
                "cost": {"type": "number", "description": "Cost in USD"},
            },
            "required": ["provider", "model", "tokens_in", "tokens_out", "cost"],
        },
    },
    {
        "name": "audit_query",
        "description": "Query the governance audit log by intent_id or task_id.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "intent_id": {"type": "string", "description": "Filter by intent ID"},
                "task_id": {"type": "string", "description": "Filter by task ID"},
                "limit": {"type": "integer", "description": "Max entries (default: 20)", "default": 20},
            },
            "required": [],
        },
    },
    {
        "name": "compliance_report",
        "description": (
            "Generate compliance evidence mapped to SOC2, GDPR, and OWASP"
            " controls from governance audit trail."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "framework": {
                    "type": "string",
                    "enum": ["soc2", "gdpr", "owasp", "all"],
                    "description": "Compliance framework to map (default: all)",
                    "default": "all",
                }
            },
            "required": [],
        },
    },
    {
        "name": "health_check",
        "description": "Run governance health probes and return overall status.",
        "inputSchema": {"type": "object", "properties": {}, "required": []},
    },
]


# ---------------------------------------------------------------------------
# Tool handlers (one per tool, keeps cyclomatic complexity low)
# ---------------------------------------------------------------------------
def _handle_governance_status(arguments):
    ks = get_kill_switch()
    cb = get_circuit_breaker()
    cg = get_cost_governor()
    budget = cg.check_budget_status()
    return {
        "kill_switch": {
            "mode": ks.mode.name if hasattr(ks.mode, "name") else str(ks.mode),
            "engaged": ks.engaged,
        },
        "circuit_breaker": {
            "state": cb.state.name if hasattr(cb.state, "name") else str(cb.state),
            "failure_count": cb.failure_count,
        },
        "cost_governor": {
            "daily_spend": budget.current_spend if hasattr(budget, "current_spend") else 0,
            "decision": (
                budget.decision.name
                if hasattr(budget, "decision") and hasattr(budget.decision, "name")
                else str(getattr(budget, "decision", "UNKNOWN"))
            ),
        },
    }


def _handle_kill_switch_status(arguments):
    ks = get_kill_switch()
    limit = arguments.get("history_limit", 5)
    status = ks.get_status()
    history = ks.get_history(limit=limit)
    return {
        "status": status,
        "history": [
            {
                "mode": str(e.mode) if hasattr(e, "mode") else str(e),
                "reason": getattr(e, "reason", ""),
                "triggered_by": getattr(e, "triggered_by", ""),
                "timestamp": str(getattr(e, "timestamp", "")),
            }
            for e in history
        ],
    }


def _handle_kill_switch_engage(arguments):
    if not arguments.get("confirm"):
        return {"error": "Must set confirm=true to engage kill switch"}
    ks = get_kill_switch()
    mode_map = {
        "HALT_NONCRITICAL": KillSwitchMode.HALT_NONCRITICAL,
        "HALT_ALL": KillSwitchMode.HALT_ALL,
        "EMERGENCY": KillSwitchMode.EMERGENCY,
    }
    mode = mode_map.get(arguments["mode"])
    if not mode:
        return {"error": f"Invalid mode: {arguments['mode']}"}
    event = ks.engage(
        mode=mode,
        reason=arguments["reason"],
        triggered_by=arguments.get("triggered_by", "mcp-client"),
    )
    return {
        "engaged": True,
        "mode": arguments["mode"],
        "reason": arguments["reason"],
        "timestamp": str(getattr(event, "timestamp", datetime.now(timezone.utc))),
    }


def _handle_kill_switch_disengage(arguments):
    ks = get_kill_switch()
    event = ks.disengage(
        triggered_by=arguments.get("triggered_by", "mcp-client"),
        reason=arguments["reason"],
    )
    return {
        "disengaged": True,
        "reason": arguments["reason"],
        "timestamp": str(getattr(event, "timestamp", datetime.now(timezone.utc))),
    }


def _handle_circuit_breaker_status(arguments):
    cb = get_circuit_breaker()
    return {
        "state": cb.state.name if hasattr(cb.state, "name") else str(cb.state),
        "failure_count": cb.failure_count,
        "success_count": getattr(cb, "success_count", 0),
        "last_failure_time": str(getattr(cb, "last_failure_time", None)),
    }


def _handle_cost_budget_check(arguments):
    cg = get_cost_governor()
    budget = cg.check_budget_status()
    result = {}
    for attr in ("current_spend", "soft_cap", "hard_cap", "decision", "rationale", "utilization"):
        val = getattr(budget, attr, None)
        if val is not None:
            result[attr] = val.name if hasattr(val, "name") else val
    return result


def _handle_cost_record_usage(arguments):
    cg = get_cost_governor()
    cg.record_usage(
        provider=arguments["provider"],
        model=arguments["model"],
        tokens_in=arguments["tokens_in"],
        tokens_out=arguments["tokens_out"],
        cost=arguments["cost"],
    )
    return {
        "recorded": True,
        "provider": arguments["provider"],
        "model": arguments["model"],
        "cost": arguments["cost"],
    }


def _handle_audit_query(arguments):
    al = get_audit_log()
    entries = []
    if arguments.get("intent_id"):
        entries = list(al.query_by_intent(arguments["intent_id"]))
    elif arguments.get("task_id"):
        entries = list(al.query_by_task(arguments["task_id"]))
    limit = arguments.get("limit", 20)
    entries = entries[:limit]
    return {
        "count": len(entries),
        "entries": [
            {k: str(v) for k, v in (e.__dict__ if hasattr(e, "__dict__") else {"data": str(e)}).items()}
            for e in entries
        ],
    }


def _handle_compliance_report(arguments):
    try:
        mapper = ComplianceMapper(governance_dir=AUDIT_DIR)
        report = (
            mapper.generate_report()
            if hasattr(mapper, "generate_report")
            else {"status": "mapper initialized", "audit_dir": AUDIT_DIR}
        )
        return {"report": str(report)}
    except Exception as e:
        return {"error": f"Compliance report generation failed: {e}"}


def _handle_health_check(arguments):
    from hummbl_governance import HealthProbe, ProbeResult

    class KillSwitchProbe(HealthProbe):
        @property
        def name(self):
            return "kill_switch"

        def check(self):
            ks = get_kill_switch()
            return ProbeResult(
                name="kill_switch",
                healthy=not ks.engaged,
                message=f"Mode: {ks.mode.name if hasattr(ks.mode, 'name') else str(ks.mode)}",
            )

    class CostGovernorProbe(HealthProbe):
        @property
        def name(self):
            return "cost_governor"

        def check(self):
            cg = get_cost_governor()
            budget = cg.check_budget_status()
            decision = getattr(budget, "decision", None)
            decision_name = decision.name if hasattr(decision, "name") else str(decision)
            return ProbeResult(
                name="cost_governor",
                healthy=decision_name != "DENY",
                message=f"Decision: {decision_name}",
            )

    collector = HealthCollector(probes=[KillSwitchProbe(), CostGovernorProbe()])
    report = collector.check_all()
    return {
        "overall_healthy": report.overall_healthy,
        "probes": [
            {"name": p.name, "healthy": p.healthy, "message": p.message}
            for p in report.probes
        ],
    }


# Dispatch table maps tool names to handler functions
_TOOL_HANDLERS = {
    "governance_status": _handle_governance_status,
    "kill_switch_status": _handle_kill_switch_status,
    "kill_switch_engage": _handle_kill_switch_engage,
    "kill_switch_disengage": _handle_kill_switch_disengage,
    "circuit_breaker_status": _handle_circuit_breaker_status,
    "cost_budget_check": _handle_cost_budget_check,
    "cost_record_usage": _handle_cost_record_usage,
    "audit_query": _handle_audit_query,
    "compliance_report": _handle_compliance_report,
    "health_check": _handle_health_check,
}


def handle_tool(name, arguments):
    """Dispatch a tool call to the appropriate governance method."""
    handler = _TOOL_HANDLERS.get(name)
    if handler is None:
        return {"error": f"Unknown tool: {name}"}
    return handler(arguments)


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
    _ensure_dirs()

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
                # Client acknowledgment, no response needed
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
