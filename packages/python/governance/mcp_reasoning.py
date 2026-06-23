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

"""MCP Server for Reasoning, Schema Validation, and Contract Net.

Exposes ReasoningEngine (Base120 mental models), SchemaValidator (stdlib-only
JSON Schema Draft 2020-12 subset), and ContractNetManager (market-based task
allocation) via the Model Context Protocol.

Tools:
    reasoning_list_models   - List all available Base120 mental models
    reasoning_get_model     - Get details of a specific model by code
    reasoning_system_prompt - Generate a specialized system prompt for a model
    schema_validate         - Validate a JSON value against a schema
    schema_validate_dict    - Validate a dict against a schema, return errors
    contract_announce       - Announce a task for bidding
    contract_bid            - Submit a bid on an announcement
    contract_evaluate       - Evaluate bids and select a winner
    contract_status         - Get announcement phase and bid count
    contract_summary        - Count announcements by phase
"""

import json
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from hummbl_governance.reasoning import ReasoningEngine
from hummbl_governance.schema_validator import SchemaValidator
from hummbl_governance.contract_net import ContractNetManager, Bid

SERVER_NAME = "hummbl-reasoning"
SERVER_VERSION = "0.1.0"
PROTOCOL_VERSION = "2024-11-05"

# Module-level singletons
_reasoning = ReasoningEngine()
_validator = SchemaValidator()
_contract_mgr = ContractNetManager()


# ---------------------------------------------------------------------------
# Tool handlers
# ---------------------------------------------------------------------------

def _reasoning_list_models(args: dict) -> dict:
    models = _reasoning.models
    return {
        "count": len(models),
        "models": [
            {
                "code": m.code,
                "name": m.name,
                "transformation": m.transformation,
            }
            for m in sorted(models.values(), key=lambda x: x.code)
        ],
    }


def _reasoning_get_model(args: dict) -> dict:
    code = args.get("code", "")
    if not code:
        return {"error": "code required"}
    model = _reasoning.get_model(code)
    if model is None:
        return {"found": False, "code": code}
    return {
        "found": True,
        "code": model.code,
        "name": model.name,
        "transformation": model.transformation,
        "definition": model.definition,
    }


def _reasoning_system_prompt(args: dict) -> dict:
    code = args.get("code", "")
    if not code:
        return {"error": "code required"}
    depth = int(args.get("depth", 1))
    try:
        prompt = _reasoning.generate_system_prompt(code, depth=depth)
        return {
            "code": code,
            "depth": depth,
            "system_prompt": prompt,
            "length": len(prompt),
        }
    except ValueError as exc:
        return {"error": str(exc)}


def _schema_validate(args: dict) -> dict:
    instance = args.get("instance")
    schema = args.get("schema")
    if schema is None:
        return {"error": "schema required"}
    if instance is None:
        return {"error": "instance required"}
    if not isinstance(schema, dict):
        return {"error": "schema must be a JSON object"}

    errors = _validator.validate(instance, schema)
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "error_count": len(errors),
    }


def _schema_validate_dict(args: dict) -> dict:
    entry = args.get("entry")
    schema = args.get("schema")
    if schema is None:
        return {"error": "schema required"}
    if entry is None:
        return {"error": "entry required"}
    if not isinstance(entry, dict):
        return {"error": "entry must be a JSON object"}
    if not isinstance(schema, dict):
        return {"error": "schema must be a JSON object"}

    valid, errors = _validator.validate_dict(entry, schema)
    return {
        "valid": valid,
        "errors": errors,
        "error_count": len(errors),
    }


def _contract_announce(args: dict) -> dict:
    announcer = args.get("announcer", "")
    task_id = args.get("task_id", "")
    if not announcer or not task_id:
        return {"error": "announcer and task_id required"}
    requirements = args.get("requirements", {})
    deadline_seconds = float(args.get("deadline_seconds", 30.0))
    metadata = args.get("metadata", {})

    ann_id = _contract_mgr.announce(
        announcer=announcer,
        task_id=task_id,
        requirements=requirements,
        deadline_seconds=deadline_seconds,
        metadata=metadata,
    )
    return {
        "announcement_id": ann_id,
        "announcer": announcer,
        "task_id": task_id,
        "deadline_seconds": deadline_seconds,
        "phase": "bidding",
    }


def _contract_bid(args: dict) -> dict:
    announcement_id = args.get("announcement_id", "")
    bidder = args.get("bidder", "")
    if not announcement_id or not bidder:
        return {"error": "announcement_id and bidder required"}

    cost = float(args.get("cost", 0.0))
    capability = float(args.get("capability", 1.0))
    estimated_seconds = float(args.get("estimated_seconds", 0.0))
    metadata = args.get("metadata", {})

    bid = Bid(
        bidder=bidder,
        cost=cost,
        capability=capability,
        estimated_seconds=estimated_seconds,
        metadata=metadata,
    )
    accepted = _contract_mgr.submit_bid(announcement_id, bid)
    return {
        "announcement_id": announcement_id,
        "bidder": bidder,
        "accepted": accepted,
        "cost": cost,
        "capability": capability,
    }


def _contract_evaluate(args: dict) -> dict:
    announcement_id = args.get("announcement_id", "")
    if not announcement_id:
        return {"error": "announcement_id required"}
    strategy = args.get("strategy")

    try:
        winner = _contract_mgr.evaluate(announcement_id, strategy=strategy)
    except KeyError:
        return {"error": f"announcement_id not found: {announcement_id}"}
    except ValueError as exc:
        return {"error": str(exc)}

    if winner is None:
        return {
            "announcement_id": announcement_id,
            "winner": None,
            "phase": "failed",
            "message": "No bids received",
        }
    return {
        "announcement_id": announcement_id,
        "winner": {
            "bidder": winner.bidder,
            "cost": winner.cost,
            "capability": winner.capability,
            "estimated_seconds": winner.estimated_seconds,
        },
        "phase": "awarded",
    }


def _contract_status(args: dict) -> dict:
    announcement_id = args.get("announcement_id", "")
    if not announcement_id:
        return {"error": "announcement_id required"}

    ann = _contract_mgr.get_announcement(announcement_id)
    if ann is None:
        return {"found": False, "announcement_id": announcement_id}

    return {
        "found": True,
        "announcement_id": announcement_id,
        "task_id": ann.task_id,
        "announcer": ann.announcer,
        "phase": ann.phase.value,
        "bid_count": len(ann.bids),
        "is_expired": ann.is_expired,
        "winner": ann.winner.bidder if ann.winner else None,
    }


def _contract_summary(args: dict) -> dict:
    summary = _contract_mgr.summary()
    active = len(_contract_mgr.list_active())
    return {
        "by_phase": summary,
        "active_bidding": active,
        "total": sum(summary.values()),
    }


# ---------------------------------------------------------------------------
# Dispatch table
# ---------------------------------------------------------------------------

_TOOLS = {
    "reasoning_list_models": _reasoning_list_models,
    "reasoning_get_model": _reasoning_get_model,
    "reasoning_system_prompt": _reasoning_system_prompt,
    "schema_validate": _schema_validate,
    "schema_validate_dict": _schema_validate_dict,
    "contract_announce": _contract_announce,
    "contract_bid": _contract_bid,
    "contract_evaluate": _contract_evaluate,
    "contract_status": _contract_status,
    "contract_summary": _contract_summary,
}

_TOOL_SCHEMAS = [
    {
        "name": "reasoning_list_models",
        "description": "List all available Base120 mental models",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "reasoning_get_model",
        "description": "Get details of a specific Base120 mental model by code",
        "inputSchema": {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "Model code (e.g. DE1, IN2, P1)"},
            },
            "required": ["code"],
        },
    },
    {
        "name": "reasoning_system_prompt",
        "description": "Generate a specialized system prompt for a Base120 mental model",
        "inputSchema": {
            "type": "object",
            "properties": {
                "code": {"type": "string"},
                "depth": {"type": "integer", "description": "Reasoning depth (default 1)"},
            },
            "required": ["code"],
        },
    },
    {
        "name": "schema_validate",
        "description": "Validate a JSON value against a JSON Schema (Draft 2020-12 subset)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "instance": {"description": "The value to validate"},
                "schema": {"type": "object", "description": "JSON Schema"},
            },
            "required": ["instance", "schema"],
        },
    },
    {
        "name": "schema_validate_dict",
        "description": "Validate a dict against a schema, returns (valid, errors)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "entry": {"type": "object"},
                "schema": {"type": "object"},
            },
            "required": ["entry", "schema"],
        },
    },
    {
        "name": "contract_announce",
        "description": "Announce a task for bidding via Contract Net Protocol",
        "inputSchema": {
            "type": "object",
            "properties": {
                "announcer": {"type": "string"},
                "task_id": {"type": "string"},
                "requirements": {"type": "object"},
                "deadline_seconds": {"type": "number"},
                "metadata": {"type": "object"},
            },
            "required": ["announcer", "task_id"],
        },
    },
    {
        "name": "contract_bid",
        "description": "Submit a bid on an announced task",
        "inputSchema": {
            "type": "object",
            "properties": {
                "announcement_id": {"type": "string"},
                "bidder": {"type": "string"},
                "cost": {"type": "number"},
                "capability": {"type": "number"},
                "estimated_seconds": {"type": "number"},
                "metadata": {"type": "object"},
            },
            "required": ["announcement_id", "bidder"],
        },
    },
    {
        "name": "contract_evaluate",
        "description": "Evaluate bids and select a winner",
        "inputSchema": {
            "type": "object",
            "properties": {
                "announcement_id": {"type": "string"},
                "strategy": {"type": "string", "description": "lowest_cost | highest_capability | best_ratio"},
            },
            "required": ["announcement_id"],
        },
    },
    {
        "name": "contract_status",
        "description": "Get phase, bid count, and winner for an announcement",
        "inputSchema": {
            "type": "object",
            "properties": {
                "announcement_id": {"type": "string"},
            },
            "required": ["announcement_id"],
        },
    },
    {
        "name": "contract_summary",
        "description": "Count all contract announcements by phase",
        "inputSchema": {"type": "object", "properties": {}},
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
        return None

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
