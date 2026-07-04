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

"""MCP Server for Physical AI Safety Governance.

Exposes KinematicGovernor (motion constraint enforcement) and
pHRISafetyMonitor (physical human-robot interaction safety) via MCP.

Tools:
    kinematic_check_motion  - Check if velocity/force/jerk are within limits
    kinematic_get_limits    - Retrieve configured kinematic limits
    kinematic_scaled_vel    - Get effective velocity limit for a safety mode
    phri_check_safety       - Evaluate safety mode from distance/collision data
    phri_get_config         - Get configured proximity thresholds
    phri_batch_check        - Check multiple sensor readings at once
"""

import json
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from hummbl_governance.physical_governor import (
    KinematicGovernor,
    pHRISafetyMonitor,
    PhysicalSafetyMode,
)

SERVER_NAME = "hummbl-physical"
SERVER_VERSION = "0.1.0"
PROTOCOL_VERSION = "2024-11-05"

# Module-level singletons (configurable via environment or per-call args)
_kinematic = KinematicGovernor()
_phri = pHRISafetyMonitor()


# ---------------------------------------------------------------------------
# Tool handlers
# ---------------------------------------------------------------------------

def _kinematic_check_motion(args: dict) -> dict:
    velocity = args.get("velocity")
    force = args.get("force")
    jerk = args.get("jerk")

    if velocity is None and force is None and jerk is None:
        return {"error": "At least one of velocity, force, or jerk must be provided"}

    result = _kinematic.check_motion(
        velocity=float(velocity) if velocity is not None else None,
        force=float(force) if force is not None else None,
        jerk=float(jerk) if jerk is not None else None,
    )
    return {
        "allowed": result["allowed"],
        "reason": result["reason"],
        "inputs": {
            "velocity": velocity,
            "force": force,
            "jerk": jerk,
        },
        "limits": {
            "max_velocity": _kinematic.max_velocity,
            "max_force": _kinematic.max_force,
            "max_jerk": _kinematic.max_jerk,
        },
    }


def _kinematic_get_limits(args: dict) -> dict:
    return {
        "max_velocity": _kinematic.max_velocity,
        "max_force": _kinematic.max_force,
        "max_jerk": _kinematic.max_jerk,
        "caution_scale": _kinematic.caution_scale,
        "caution_velocity": _kinematic.max_velocity * _kinematic.caution_scale,
        "emergency_velocity": 0.0,
    }


def _kinematic_scaled_vel(args: dict) -> dict:
    mode_str = args.get("mode", "normal").lower()
    mode_map = {
        "normal": PhysicalSafetyMode.NORMAL,
        "caution": PhysicalSafetyMode.CAUTION,
        "emergency": PhysicalSafetyMode.EMERGENCY,
    }
    mode = mode_map.get(mode_str)
    if mode is None:
        return {
            "error": f"Unknown mode '{mode_str}'. Valid: normal, caution, emergency"
        }
    effective_vel = _kinematic.get_scaled_velocity(mode)
    return {
        "mode": mode_str,
        "effective_velocity": effective_vel,
        "max_velocity": _kinematic.max_velocity,
        "reduction_factor": (
            round(effective_vel / _kinematic.max_velocity, 4)
            if _kinematic.max_velocity > 0
            else 0.0
        ),
    }


def _phri_check_safety(args: dict) -> dict:
    distance = args.get("distance")
    collision = bool(args.get("collision", False))

    result = _phri.check_safety(
        distance=float(distance) if distance is not None else None,
        collision=collision,
    )
    mode = result["mode"]
    return {
        "mode": mode.value if isinstance(mode, PhysicalSafetyMode) else str(mode),
        "reason": result["reason"],
        "safe": mode == PhysicalSafetyMode.NORMAL if isinstance(mode, PhysicalSafetyMode) else False,
        "inputs": {
            "distance": distance,
            "collision": collision,
        },
    }


def _phri_get_config(args: dict) -> dict:
    return {
        "min_distance": _phri.min_distance,
        "critical_distance": _phri.critical_distance,
        "modes": {
            "normal": f"distance > {_phri.min_distance}m",
            "caution": f"{_phri.critical_distance}m < distance <= {_phri.min_distance}m",
            "emergency": f"distance <= {_phri.critical_distance}m or collision=True",
        },
    }


def _phri_batch_check(args: dict) -> dict:
    readings = args.get("readings", [])
    if not readings:
        return {"error": "readings list required"}
    if not isinstance(readings, list):
        return {"error": "readings must be a list"}

    results = []
    emergency_count = 0
    caution_count = 0

    for i, reading in enumerate(readings):
        if not isinstance(reading, dict):
            results.append({"index": i, "error": "reading must be an object"})
            continue
        distance = reading.get("distance")
        collision = bool(reading.get("collision", False))
        result = _phri.check_safety(
            distance=float(distance) if distance is not None else None,
            collision=collision,
        )
        mode = result["mode"]
        mode_str = mode.value if isinstance(mode, PhysicalSafetyMode) else str(mode)
        results.append({
            "index": i,
            "mode": mode_str,
            "reason": result["reason"],
            "safe": mode == PhysicalSafetyMode.NORMAL if isinstance(mode, PhysicalSafetyMode) else False,
        })
        if mode == PhysicalSafetyMode.EMERGENCY:
            emergency_count += 1
        elif mode == PhysicalSafetyMode.CAUTION:
            caution_count += 1

    return {
        "results": results,
        "total": len(readings),
        "emergency_count": emergency_count,
        "caution_count": caution_count,
        "safe_count": len(readings) - emergency_count - caution_count,
        "any_emergency": emergency_count > 0,
    }


# ---------------------------------------------------------------------------
# Dispatch table
# ---------------------------------------------------------------------------

_TOOLS = {
    "kinematic_check_motion": _kinematic_check_motion,
    "kinematic_get_limits": _kinematic_get_limits,
    "kinematic_scaled_vel": _kinematic_scaled_vel,
    "phri_check_safety": _phri_check_safety,
    "phri_get_config": _phri_get_config,
    "phri_batch_check": _phri_batch_check,
}

_TOOL_SCHEMAS = [
    {
        "name": "kinematic_check_motion",
        "description": "Check if proposed velocity/force/jerk values are within kinematic limits",
        "inputSchema": {
            "type": "object",
            "properties": {
                "velocity": {"type": "number", "description": "Velocity in m/s"},
                "force": {"type": "number", "description": "Force in Newtons"},
                "jerk": {"type": "number", "description": "Jerk in m/s^3"},
            },
        },
    },
    {
        "name": "kinematic_get_limits",
        "description": "Retrieve configured kinematic limits and caution/emergency thresholds",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "kinematic_scaled_vel",
        "description": "Get effective velocity limit for a given safety mode",
        "inputSchema": {
            "type": "object",
            "properties": {
                "mode": {"type": "string", "description": "normal | caution | emergency"},
            },
            "required": ["mode"],
        },
    },
    {
        "name": "phri_check_safety",
        "description": "Evaluate pHRI safety mode from distance/collision sensor data",
        "inputSchema": {
            "type": "object",
            "properties": {
                "distance": {"type": "number", "description": "Distance to human in meters"},
                "collision": {"type": "boolean", "description": "True if collision detected"},
            },
        },
    },
    {
        "name": "phri_get_config",
        "description": "Get configured pHRI proximity thresholds and mode boundaries",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "phri_batch_check",
        "description": "Check multiple sensor readings at once, returns per-reading safety mode",
        "inputSchema": {
            "type": "object",
            "properties": {
                "readings": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "distance": {"type": "number"},
                            "collision": {"type": "boolean"},
                        },
                    },
                    "description": "List of {distance, collision} sensor readings",
                },
            },
            "required": ["readings"],
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
