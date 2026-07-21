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

"""MCP Server for Agent Sandboxing.

Combines kill switch, circuit breaker, capability fence, and output validator
into a unified sandboxing service. "Run any agent inside HUMMBL guardrails."

Inspired by Cloudflare Dynamic Workers + NVIDIA OpenShell patterns.

Tools:
    sandbox_create    - Create a sandbox with policy constraints
    sandbox_check     - Check if an action is allowed within a sandbox
    sandbox_validate  - Validate agent output against rules
    sandbox_status    - Get sandbox state (all primitives)
    sandbox_destroy   - Tear down a sandbox and emit audit receipt
"""

import json
import os
import sys
import tempfile
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from hummbl_governance import (
    KillSwitch,
    CircuitBreaker,
)

try:
    from hummbl_governance.capability_fence import CapabilityFence
except ImportError:
    CapabilityFence = None

try:
    from hummbl_governance.output_validator import OutputValidator
except ImportError:
    OutputValidator = None

from hummbl_governance import AuditLog

SERVER_NAME = "agent-sandbox"
SERVER_VERSION = "0.1.0"
PROTOCOL_VERSION = "2024-11-05"

STATE_DIR = Path(os.environ.get("SANDBOX_STATE_DIR", os.path.join(tempfile.gettempdir(), "hummbl-sandbox")))

# Active sandboxes
_sandboxes = {}


class Sandbox:
    """An isolated governance context for an agent."""

    def __init__(self, sandbox_id, agent_name, allowed_tools=None,
                 blocked_paths=None, max_cost=10.0, timeout_sec=300):
        self.id = sandbox_id
        self.agent = agent_name
        self.allowed_tools = set(allowed_tools or [])
        self.blocked_paths = set(blocked_paths or [])
        self.max_cost = max_cost
        self.timeout_sec = timeout_sec
        self.created_at = datetime.now(timezone.utc)
        self.actions = []
        self.cost_spent = 0.0

        state_dir = STATE_DIR / sandbox_id
        state_dir.mkdir(parents=True, exist_ok=True)

        self.kill_switch = KillSwitch(state_dir=state_dir)
        self.circuit_breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=30)
        self.audit = AuditLog(base_dir=str(state_dir / "audit"))

    def _check_hard_blocks(self, tool):
        """Check kill switch and circuit breaker (hard denials)."""
        if self.kill_switch.engaged:
            return {"allowed": False, "reason": f"Kill switch engaged: {self.kill_switch.mode}"}
        if hasattr(self.circuit_breaker, 'state') and self.circuit_breaker.state.name == "OPEN":
            return {"allowed": False, "reason": "Circuit breaker OPEN — too many failures"}
        return None

    def _check_policy(self, tool, path, cost):
        """Check tool allowlist, path blocklist, and cost cap."""
        reasons = []
        if self.allowed_tools and tool not in self.allowed_tools:
            reasons.append(f"Tool '{tool}' not in allowed set: {sorted(self.allowed_tools)}")
        if path:
            for bp in self.blocked_paths:
                if path.startswith(bp):
                    reasons.append(f"Path '{path}' is in blocked scope: {bp}")
        if self.cost_spent + cost > self.max_cost:
            reasons.append(f"Cost ${self.cost_spent + cost:.2f} would exceed cap ${self.max_cost:.2f}")
        return reasons

    def check_action(self, tool, path=None, cost=0.0):
        """Check if an action is allowed."""
        block = self._check_hard_blocks(tool)
        if block:
            return block

        reasons = self._check_policy(tool, path, cost)
        if reasons:
            return {"allowed": False, "reasons": reasons}

        self.cost_spent += cost
        self.actions.append({
            "tool": tool, "path": path, "cost": cost,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return {"allowed": True, "cost_remaining": round(self.max_cost - self.cost_spent, 2)}

    def to_dict(self):
        return {
            "id": self.id,
            "agent": self.agent,
            "created_at": self.created_at.isoformat(),
            "allowed_tools": sorted(self.allowed_tools) if self.allowed_tools else "all",
            "blocked_paths": sorted(self.blocked_paths),
            "max_cost": self.max_cost,
            "cost_spent": round(self.cost_spent, 2),
            "actions_count": len(self.actions),
            "kill_switch": (
                self.kill_switch.mode.name
                if hasattr(self.kill_switch.mode, "name")
                else str(self.kill_switch.mode)
            ),
            "circuit_breaker": (
                self.circuit_breaker.state.name
                if hasattr(self.circuit_breaker.state, "name")
                else str(self.circuit_breaker.state)
            ),
        }


TOOLS = [
    {
        "name": "sandbox_create",
        "description": (
            "Create an isolated sandbox for an agent with policy constraints"
            " (tool allowlist, path blocklist, cost cap)."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "agent_name": {"type": "string", "description": "Agent identity"},
                "allowed_tools": {
                    "type": "array", "items": {"type": "string"},
                    "description": "Allowlist of tools (empty = all allowed)",
                },
                "blocked_paths": {
                    "type": "array", "items": {"type": "string"},
                    "description": "Paths the agent cannot access",
                },
                "max_cost": {"type": "number", "description": "Maximum cost in USD (default: 10.0)", "default": 10.0},
                "timeout_sec": {"type": "integer", "description": "Timeout in seconds (default: 300)", "default": 300},
            },
            "required": ["agent_name"],
        },
    },
    {
        "name": "sandbox_check",
        "description": "Check if an action is allowed within a sandbox.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sandbox_id": {"type": "string", "description": "Sandbox ID"},
                "tool": {"type": "string", "description": "Tool name being invoked"},
                "path": {"type": "string", "description": "File path being accessed (optional)"},
                "cost": {"type": "number", "description": "Estimated cost of this action (default: 0)", "default": 0},
            },
            "required": ["sandbox_id", "tool"],
        },
    },
    {
        "name": "sandbox_validate_output",
        "description": "Validate agent output against sandbox rules (no secrets, no blocked content).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sandbox_id": {"type": "string", "description": "Sandbox ID"},
                "output": {"type": "string", "description": "Agent output text to validate"},
            },
            "required": ["sandbox_id", "output"],
        },
    },
    {
        "name": "sandbox_status",
        "description": "Get full sandbox state: kill switch, circuit breaker, cost, actions.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sandbox_id": {"type": "string", "description": "Sandbox ID (omit for all sandboxes)"},
            },
            "required": [],
        },
    },
    {
        "name": "sandbox_destroy",
        "description": "Tear down a sandbox and emit an audit receipt.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sandbox_id": {"type": "string", "description": "Sandbox ID"},
            },
            "required": ["sandbox_id"],
        },
    },
]


def _handle_sandbox_create(arguments):
    sid = f"sbx-{uuid.uuid4().hex[:8]}"
    sb = Sandbox(
        sandbox_id=sid,
        agent_name=arguments["agent_name"],
        allowed_tools=arguments.get("allowed_tools"),
        blocked_paths=arguments.get("blocked_paths"),
        max_cost=arguments.get("max_cost", 10.0),
        timeout_sec=arguments.get("timeout_sec", 300),
    )
    _sandboxes[sid] = sb
    return {"created": True, "sandbox": sb.to_dict()}


def _handle_sandbox_check(arguments):
    sid = arguments["sandbox_id"]
    sb = _sandboxes.get(sid)
    if not sb:
        return {"error": f"Sandbox {sid} not found"}
    return sb.check_action(
        tool=arguments["tool"],
        path=arguments.get("path"),
        cost=arguments.get("cost", 0),
    )


def _handle_sandbox_validate_output(arguments):
    import re

    sid = arguments["sandbox_id"]
    sb = _sandboxes.get(sid)
    if not sb:
        return {"error": f"Sandbox {sid} not found"}
    output = arguments["output"]
    issues = []
    secret_patterns = [
        (r'sk-[a-zA-Z0-9_-]{10,}', "API key (sk-...)"),
        (r'ghp_[a-zA-Z0-9]{36}', "GitHub PAT"),
        (r'AKIA[A-Z0-9]{16}', "AWS access key"),
        (r'-----BEGIN.*PRIVATE KEY-----', "Private key"),
    ]
    for pattern, desc in secret_patterns:
        if re.search(pattern, output):
            issues.append({"type": "secret_leak", "pattern": desc})
    if len(output) > 100000:
        issues.append({"type": "excessive_output", "length": len(output)})
    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "output_length": len(output),
    }


def _handle_sandbox_status(arguments):
    sid = arguments.get("sandbox_id")
    if sid:
        sb = _sandboxes.get(sid)
        if not sb:
            return {"error": f"Sandbox {sid} not found"}
        return {"sandbox": sb.to_dict()}
    return {
        "active_sandboxes": len(_sandboxes),
        "sandboxes": [sb.to_dict() for sb in _sandboxes.values()],
    }


def _handle_sandbox_destroy(arguments):
    sid = arguments["sandbox_id"]
    sb = _sandboxes.pop(sid, None)
    if not sb:
        return {"error": f"Sandbox {sid} not found"}
    return {
        "destroyed": True,
        "sandbox_id": sid,
        "agent": sb.agent,
        "duration_sec": (datetime.now(timezone.utc) - sb.created_at).total_seconds(),
        "total_actions": len(sb.actions),
        "total_cost": round(sb.cost_spent, 2),
        "kill_switch_engaged": sb.kill_switch.engaged,
    }


_SANDBOX_HANDLERS = {
    "sandbox_create": _handle_sandbox_create,
    "sandbox_check": _handle_sandbox_check,
    "sandbox_validate_output": _handle_sandbox_validate_output,
    "sandbox_status": _handle_sandbox_status,
    "sandbox_destroy": _handle_sandbox_destroy,
}


def handle_tool(name, arguments):
    handler = _SANDBOX_HANDLERS.get(name)
    if handler is None:
        return {"error": f"Unknown tool: {name}"}
    return handler(arguments)


def send_response(msg_id, result):
    response = {"jsonrpc": "2.0", "id": msg_id, "result": result}
    sys.stdout.write(json.dumps(response) + "\n")
    sys.stdout.flush()


def send_error(msg_id, code, message):
    response = {"jsonrpc": "2.0", "id": msg_id, "error": {"code": code, "message": message}}
    sys.stdout.write(json.dumps(response) + "\n")
    sys.stdout.flush()


def main():
    STATE_DIR.mkdir(parents=True, exist_ok=True)
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
                    "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
                })
            elif method == "notifications/initialized":
                pass
            elif method == "tools/list":
                send_response(msg_id, {"tools": TOOLS})
            elif method == "tools/call":
                result = handle_tool(params.get("name", ""), params.get("arguments", {}))
                send_response(msg_id, {
                    "content": [{"type": "text", "text": json.dumps(result, indent=2, default=str)}],
                })
            elif method == "ping":
                send_response(msg_id, {})
            else:
                send_error(msg_id, -32601, f"Method not found: {method}")
        except Exception as e:
            send_error(msg_id, -32603, f"Internal error: {e}\n{traceback.format_exc()}")


if __name__ == "__main__":
    main()
