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

"""MCP Server for Identity, Delegation, and Causal Ordering.

Exposes AgentRegistry (identity + trust), DelegationTokenManager (HMAC-signed
capability tokens), and LamportClock (causal event ordering) via the Model
Context Protocol.

Tools:
    identity_register      - Register an agent with a trust tier
    identity_lookup        - Look up agent status and trust tier
    identity_list          - List all registered agents
    identity_validate      - Check if an agent is a valid sender
    delegation_create      - Create a signed delegation token
    delegation_validate    - Validate a delegation token
    delegation_check_op    - Check least-privilege for an operation
    lamport_tick           - Advance the clock (local event)
    lamport_receive        - Receive a remote timestamp
    lamport_compare        - Compare two timestamps for causal ordering
"""

import json
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from hummbl_governance.identity import AgentRegistry
from hummbl_governance.delegation import (
    DelegationTokenManager,
    DelegationToken,
    TokenBinding,
)
from hummbl_governance.lamport_clock import LamportClock, LamportTimestamp

SERVER_NAME = "hummbl-identity"
SERVER_VERSION = "0.1.0"
PROTOCOL_VERSION = "2024-11-05"

# Module-level singletons
_registry = AgentRegistry()
_delegation_mgr = DelegationTokenManager()
_lamport = LamportClock(agent_id="mcp-identity-server")

# Store issued tokens by token_id for subsequent validation calls
_tokens: dict[str, DelegationToken] = {}


# ---------------------------------------------------------------------------
# Tool handlers
# ---------------------------------------------------------------------------

def _identity_register(args: dict) -> dict:
    agent_id = args.get("agent_id", "")
    trust_tier = args.get("trust_tier", "low")
    aliases = args.get("aliases", [])
    if not agent_id:
        return {"error": "agent_id required"}
    try:
        _registry.register_agent(agent_id, trust=trust_tier)
        for alias in aliases:
            _registry.add_alias(alias, agent_id)
        return {
            "agent_id": agent_id,
            "trust_tier": trust_tier,
            "aliases": aliases,
            "registered": True,
        }
    except Exception as exc:
        return {"error": str(exc)}


def _identity_lookup(args: dict) -> dict:
    agent_id = args.get("agent_id", "")
    if not agent_id:
        return {"error": "agent_id required"}
    canonical = _registry.canonicalize(agent_id)
    # canonicalize returns the original string if unknown
    agents = _registry.get_agents()
    if canonical not in agents:
        return {"found": False, "agent_id": agent_id}
    # Get aliases that point to this canonical
    all_aliases = _registry.get_aliases()
    agent_aliases = [k for k, v in all_aliases.items() if v == canonical]
    return {
        "found": True,
        "agent_id": canonical,
        "trust_tier": _registry.get_trust_tier(canonical),
        "status": _registry.get_status(canonical),
        "is_deprecated": _registry.is_deprecated(canonical),
        "aliases": agent_aliases,
    }


def _identity_list(args: dict) -> dict:
    agents = _registry.get_agents()
    return {
        "count": len(agents),
        "agents": [
            {
                "agent_id": a,
                "trust_tier": _registry.get_trust_tier(a),
                "status": _registry.get_status(a),
            }
            for a in agents
        ],
    }


def _identity_validate(args: dict) -> dict:
    agent_id = args.get("agent_id", "")
    if not agent_id:
        return {"error": "agent_id required"}
    canonical = _registry.canonicalize(agent_id)
    valid = _registry.is_valid_sender(agent_id) if canonical else False
    return {
        "agent_id": agent_id,
        "canonical": canonical,
        "valid_sender": valid,
    }


def _delegation_create(args: dict) -> dict:
    issuer = args.get("issuer", "")
    subject = args.get("subject", "")
    ops_allowed = args.get("ops_allowed", [])
    task_id = args.get("task_id", "")
    contract_id = args.get("contract_id", "")
    expiry_minutes = args.get("expiry_minutes", 120)

    if not issuer or not subject:
        return {"error": "issuer and subject required"}
    if not task_id or not contract_id:
        return {"error": "task_id and contract_id required"}
    if not ops_allowed:
        return {"error": "ops_allowed must be non-empty"}

    binding = TokenBinding(task_id=task_id, contract_id=contract_id)
    token = _delegation_mgr.create_token(
        issuer=issuer,
        subject=subject,
        ops_allowed=ops_allowed,
        binding=binding,
        expiry_minutes=expiry_minutes if expiry_minutes is not None else None,
    )
    _tokens[token.token_id] = token
    return {
        "token_id": token.token_id,
        "issuer": token.issuer,
        "subject": token.subject,
        "ops_allowed": list(token.ops_allowed),
        "expiry": token.expiry,
        "binding": {
            "task_id": token.binding.task_id,
            "contract_id": token.binding.contract_id,
        } if token.binding else None,
        "signature": token.signature[:16] + "...",  # truncated for safety
    }


def _delegation_validate(args: dict) -> dict:
    token_id = args.get("token_id", "")
    if not token_id:
        return {"error": "token_id required"}
    token = _tokens.get(token_id)
    if token is None:
        return {"valid": False, "error": "token_id not found in server cache"}

    expected_task = args.get("expected_task_id")
    expected_contract = args.get("expected_contract_id")
    expected_subject = args.get("expected_subject")

    valid, error_code = _delegation_mgr.validate_token(
        token,
        expected_task_id=expected_task,
        expected_contract_id=expected_contract,
        expected_subject=expected_subject,
    )
    return {
        "token_id": token_id,
        "valid": valid,
        "error_code": error_code,
        "expired": token.is_expired(),
    }


def _delegation_check_op(args: dict) -> dict:
    token_id = args.get("token_id", "")
    requested_op = args.get("requested_op", "")
    if not token_id or not requested_op:
        return {"error": "token_id and requested_op required"}
    token = _tokens.get(token_id)
    if token is None:
        return {"allowed": False, "error": "token_id not found"}

    allowed_tools = args.get("allowed_tools")
    denied_tools = args.get("denied_tools")

    ok, error_code = _delegation_mgr.check_least_privilege(
        token,
        requested_op=requested_op,
        allowed_tools=allowed_tools,
        denied_tools=denied_tools,
    )
    return {
        "token_id": token_id,
        "requested_op": requested_op,
        "allowed": ok,
        "error_code": error_code,
        "ops_allowed": list(token.ops_allowed),
    }


def _lamport_tick(args: dict) -> dict:
    new_val = _lamport.tick()
    ts = LamportTimestamp(new_val, _lamport.agent_id)
    return {
        "time": ts.time,
        "agent_id": ts.agent_id,
        "event": "internal_tick",
    }


def _lamport_receive(args: dict) -> dict:
    remote_timestamp = args.get("remote_timestamp")
    if remote_timestamp is None:
        return {"error": "remote_timestamp required"}
    try:
        new_val = _lamport.receive(int(remote_timestamp))
    except ValueError as exc:
        return {"error": str(exc)}
    return {
        "time": new_val,
        "agent_id": _lamport.agent_id,
        "remote_timestamp": remote_timestamp,
    }


def _lamport_compare(args: dict) -> dict:
    ts1_time = args.get("ts1_time")
    ts1_agent = args.get("ts1_agent", "")
    ts2_time = args.get("ts2_time")
    ts2_agent = args.get("ts2_agent", "")
    if ts1_time is None or ts2_time is None:
        return {"error": "ts1_time and ts2_time required"}
    ts1 = LamportTimestamp(int(ts1_time), ts1_agent)
    ts2 = LamportTimestamp(int(ts2_time), ts2_agent)
    result = LamportClock.happened_before(ts1, ts2)
    if result is True:
        ordering = "ts1_before_ts2"
    elif result is False:
        ordering = "ts2_before_ts1"
    else:
        ordering = "concurrent"
    return {
        "ts1": {"time": ts1.time, "agent_id": ts1.agent_id},
        "ts2": {"time": ts2.time, "agent_id": ts2.agent_id},
        "ordering": ordering,
        "happened_before": result,
    }


# ---------------------------------------------------------------------------
# Dispatch table
# ---------------------------------------------------------------------------

_TOOLS = {
    "identity_register": _identity_register,
    "identity_lookup": _identity_lookup,
    "identity_list": _identity_list,
    "identity_validate": _identity_validate,
    "delegation_create": _delegation_create,
    "delegation_validate": _delegation_validate,
    "delegation_check_op": _delegation_check_op,
    "lamport_tick": _lamport_tick,
    "lamport_receive": _lamport_receive,
    "lamport_compare": _lamport_compare,
}

_TOOL_SCHEMAS = [
    {
        "name": "identity_register",
        "description": "Register an agent with a trust tier",
        "inputSchema": {
            "type": "object",
            "properties": {
                "agent_id": {"type": "string", "description": "Canonical agent ID"},
                "trust_tier": {"type": "string", "description": "Trust tier: high/medium/low"},
                "aliases": {"type": "array", "items": {"type": "string"}, "description": "Optional alternate names"},
            },
            "required": ["agent_id"],
        },
    },
    {
        "name": "identity_lookup",
        "description": "Look up agent status and trust tier",
        "inputSchema": {
            "type": "object",
            "properties": {
                "agent_id": {"type": "string", "description": "Agent ID or alias"},
            },
            "required": ["agent_id"],
        },
    },
    {
        "name": "identity_list",
        "description": "List all registered agents",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "identity_validate",
        "description": "Check if an agent is a valid sender",
        "inputSchema": {
            "type": "object",
            "properties": {
                "agent_id": {"type": "string"},
            },
            "required": ["agent_id"],
        },
    },
    {
        "name": "delegation_create",
        "description": "Create a signed delegation token binding issuer to subject for ops",
        "inputSchema": {
            "type": "object",
            "properties": {
                "issuer": {"type": "string"},
                "subject": {"type": "string"},
                "ops_allowed": {"type": "array", "items": {"type": "string"}},
                "task_id": {"type": "string"},
                "contract_id": {"type": "string"},
                "expiry_minutes": {"type": "integer", "description": "Minutes until expiry (null = no expiry)"},
            },
            "required": ["issuer", "subject", "ops_allowed", "task_id", "contract_id"],
        },
    },
    {
        "name": "delegation_validate",
        "description": "Validate a delegation token by token_id",
        "inputSchema": {
            "type": "object",
            "properties": {
                "token_id": {"type": "string"},
                "expected_task_id": {"type": "string"},
                "expected_contract_id": {"type": "string"},
                "expected_subject": {"type": "string"},
            },
            "required": ["token_id"],
        },
    },
    {
        "name": "delegation_check_op",
        "description": "Check least-privilege: is requested_op in token's ops_allowed?",
        "inputSchema": {
            "type": "object",
            "properties": {
                "token_id": {"type": "string"},
                "requested_op": {"type": "string"},
                "allowed_tools": {"type": "array", "items": {"type": "string"}},
                "denied_tools": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["token_id", "requested_op"],
        },
    },
    {
        "name": "lamport_tick",
        "description": "Advance the Lamport clock for a local event",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "lamport_receive",
        "description": "Advance the clock on receipt of a remote timestamp",
        "inputSchema": {
            "type": "object",
            "properties": {
                "remote_timestamp": {"type": "integer"},
            },
            "required": ["remote_timestamp"],
        },
    },
    {
        "name": "lamport_compare",
        "description": "Compare two Lamport timestamps for causal ordering",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ts1_time": {"type": "integer"},
                "ts1_agent": {"type": "string"},
                "ts2_time": {"type": "integer"},
                "ts2_agent": {"type": "string"},
            },
            "required": ["ts1_time", "ts2_time"],
        },
    },
]


# ---------------------------------------------------------------------------
# Protocol helpers
# ---------------------------------------------------------------------------

def _ok(request_id, result):
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _err(request_id, code, message):
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def handle_request(req: dict) -> dict:
    method = req.get("method", "")
    req_id = req.get("id")
    params = req.get("params", {})

    if method == "initialize":
        return _ok(req_id, {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {"tools": {}},
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
        })

    if method == "tools/list":
        return _ok(req_id, {"tools": _TOOL_SCHEMAS})

    if method == "tools/call":
        tool_name = params.get("name", "")
        tool_args = params.get("arguments", {})
        handler = _TOOLS.get(tool_name)
        if handler is None:
            return _err(req_id, -32601, f"Unknown tool: {tool_name}")
        try:
            result = handler(tool_args)
            return _ok(req_id, {
                "content": [{"type": "text", "text": json.dumps(result, default=str)}]
            })
        except Exception:
            tb = traceback.format_exc()
            return _err(req_id, -32000, tb)

    if method == "notifications/initialized":
        return None  # no response for notifications

    return _err(req_id, -32601, f"Method not found: {method}")


def handle_tool(tool_name: str, args: dict) -> dict:
    """Direct tool dispatch (used by tests)."""
    handler = _TOOLS.get(tool_name)
    if handler is None:
        return {"error": f"Unknown tool: {tool_name}"}
    return handler(args)


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError as exc:
            resp = _err(None, -32700, f"Parse error: {exc}")
            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()
            continue

        resp = handle_request(req)
        if resp is not None:
            sys.stdout.write(json.dumps(resp, default=str) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
