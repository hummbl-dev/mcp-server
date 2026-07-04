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

"""Base120 MCP server — JSON-RPC 2.0 over stdio.

Exposes the Engine as five MCP tools:

  base120_get       — look up an operator by code
  base120_list      — list operators, optionally filtered by family
  base120_families  — return the 6 canonical family codes
  base120_prompt    — generate a system prompt for an operator + problem
  base120_record    — record an operator application as a governance artifact

Wire into Claude Code's MCP config (settings.json)::

    {
      "mcpServers": {
        "base120": {
          "command": "base120-mcp"
        }
      }
    }

Zero third-party dependencies. Stdlib only. JSON-RPC 2.0.
"""

from __future__ import annotations

import json
import sys
from typing import Any

from base120 import __version__
from base120.engine import Engine

# JSON-RPC 2.0 error codes
_METHOD_NOT_FOUND = -32601
_INVALID_PARAMS = -32602
_INTERNAL_ERROR = -32603


# ---------------------------------------------------------------------------
# MCP content helpers
# ---------------------------------------------------------------------------

def _ok_content(text: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": text}]}


def _error_content(message: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": message}], "isError": True}


# ---------------------------------------------------------------------------
# Tool schemas (used by tools/list)
# ---------------------------------------------------------------------------

_TOOLS = [
    {
        "name": "base120_get",
        "description": "Look up a Base120 reasoning operator by code (e.g. 'P6', 'DE1').",
        "inputSchema": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "Operator code, e.g. 'P6' or 'DE1'.",
                },
            },
            "required": ["code"],
        },
    },
    {
        "name": "base120_list",
        "description": (
            "List Base120 operators, optionally filtered by family. "
            "Returns all 120 operators when no family is given."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "family": {
                    "type": "string",
                    "description": "Family code: P, IN, CO, DE, RE, or SY (case-insensitive).",
                },
            },
        },
    },
    {
        "name": "base120_families",
        "description": "Return the 6 canonical Base120 family codes in order: P, IN, CO, DE, RE, SY.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "base120_prompt",
        "description": (
            "Generate a system prompt for applying a Base120 operator to a problem. "
            "The prompt is suitable for any LLM and requests a structured JSON response."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "Operator code, e.g. 'P6'.",
                },
                "problem": {
                    "type": "string",
                    "description": "The problem statement to reason about.",
                },
            },
            "required": ["code", "problem"],
        },
    },
    {
        "name": "base120_select",
        "description": (
            "Recommend the most relevant Base120 operators for a problem description. "
            "Uses keyword overlap with operator names and definitions."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "problem": {
                    "type": "string",
                    "description": "Natural-language problem description.",
                },
                "n": {
                    "type": "integer",
                    "description": "Number of recommendations to return (default 5).",
                },
            },
            "required": ["problem"],
        },
    },
    {
        "name": "base120_record",
        "description": (
            "Record a completed Base120 operator application as a VERUM-aligned "
            "governance artifact. Returns the ApplyResult and its OperatorTuple."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "Operator code, e.g. 'P6'.",
                },
                "problem": {
                    "type": "string",
                    "description": "The original problem statement.",
                },
                "recommendation": {
                    "type": "string",
                    "description": "The output of the reasoning application.",
                },
                "confidence": {
                    "type": "number",
                    "description": "Certainty score 0.0–1.0.",
                },
            },
            "required": ["code", "problem", "recommendation", "confidence"],
        },
    },
]


# ---------------------------------------------------------------------------
# Server
# ---------------------------------------------------------------------------

class Base120Server:
    """Minimal MCP server exposing the Base120 engine as JSON-RPC 2.0 tools.

    Usage (handler layer only, for testing)::

        server = Base120Server()
        result = server.handle_tools_call("base120_get", {"code": "P6"})

    Usage (full stdio loop)::

        server = Base120Server()
        server.run()
    """

    def __init__(self) -> None:
        self._engine = Engine()

    # ------------------------------------------------------------------
    # MCP method handlers
    # ------------------------------------------------------------------

    def handle_initialize(self, params: dict[str, Any]) -> dict[str, Any]:
        return {
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "base120", "version": __version__},
        }

    def handle_tools_list(self, params: dict[str, Any]) -> dict[str, Any]:
        return {"tools": _TOOLS}

    def handle_tools_call(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Route a tool call and return an MCP content response."""
        handlers = {
            "base120_get": self._call_get,
            "base120_list": self._call_list,
            "base120_families": self._call_families,
            "base120_prompt": self._call_prompt,
            "base120_select": self._call_select,
            "base120_record": self._call_record,
        }
        handler = handlers.get(name)
        if handler is None:
            return _error_content(f"Unknown tool: {name!r}")
        try:
            return handler(arguments)
        except (KeyError, TypeError, ValueError) as exc:
            return _error_content(str(exc))

    # ------------------------------------------------------------------
    # Tool implementations
    # ------------------------------------------------------------------

    def _call_get(self, args: dict[str, Any]) -> dict[str, Any]:
        code = args.get("code")
        if not code:
            return _error_content("Missing required parameter: 'code'")
        op = self._engine.get(code)
        if op is None:
            return _error_content(f"Unknown operator code: {code!r}")
        return _ok_content(json.dumps({
            "code": op.code,
            "name": op.name,
            "transformation": op.transformation,
            "definition": op.definition,
        }))

    def _call_list(self, args: dict[str, Any]) -> dict[str, Any]:
        family = args.get("family")
        ops = self._engine.list(family=family)
        return _ok_content(json.dumps([
            {"code": op.code, "name": op.name, "transformation": op.transformation}
            for op in ops
        ]))

    def _call_families(self, args: dict[str, Any]) -> dict[str, Any]:
        return _ok_content(json.dumps(self._engine.families()))

    def _call_prompt(self, args: dict[str, Any]) -> dict[str, Any]:
        code = args.get("code")
        problem = args.get("problem")
        if not code:
            return _error_content("Missing required parameter: 'code'")
        if not problem:
            return _error_content("Missing required parameter: 'problem'")
        try:
            prompt = self._engine.prompt(code, problem)
        except ValueError as exc:
            return _error_content(str(exc))
        return _ok_content(prompt)

    def _call_select(self, args: dict[str, Any]) -> dict[str, Any]:
        problem = args.get("problem")
        if problem is None:
            return _error_content("Missing required parameter: 'problem'")
        n = args.get("n", 5)
        try:
            n = int(n)
        except (TypeError, ValueError):
            return _error_content("Parameter 'n' must be an integer")
        results = self._engine.select(problem, n=n)
        return _ok_content(json.dumps([
            {"code": op.code, "name": op.name, "transformation": op.transformation, "score": score}
            for op, score in results
        ]))

    def _call_record(self, args: dict[str, Any]) -> dict[str, Any]:
        for param in ("code", "problem", "recommendation", "confidence"):
            if param not in args:
                return _error_content(f"Missing required parameter: {param!r}")
        try:
            result = self._engine.record(
                code=args["code"],
                problem=args["problem"],
                recommendation=args["recommendation"],
                confidence=args["confidence"],
            )
        except ValueError as exc:
            return _error_content(str(exc))
        t = result.to_tuple()
        return _ok_content(json.dumps({
            "code": result.code,
            "name": result.name,
            "problem": result.problem,
            "recommendation": result.recommendation,
            "confidence": result.confidence,
            "evidence_id": result.evidence_id,
            "tuple": {"id": t.id, "time": t.time, "state": t.state, "drift": t.drift},
        }))

    # ------------------------------------------------------------------
    # JSON-RPC 2.0 dispatcher
    # ------------------------------------------------------------------

    def dispatch(self, request: dict[str, Any]) -> dict[str, Any] | None:
        """Route one JSON-RPC 2.0 request to the appropriate handler.

        Returns a response dict, or None for notifications (no id).
        """
        req_id = request.get("id")
        method = request.get("method", "")

        # Notifications have no id — no response
        if req_id is None and not method.startswith("initialize"):
            return None

        try:
            params = request.get("params") or {}
            if method == "initialize":
                result = self.handle_initialize(params)
            elif method == "notifications/initialized":
                return None
            elif method == "tools/list":
                result = self.handle_tools_list(params)
            elif method == "tools/call":
                tool_name = params.get("name", "")
                arguments = params.get("arguments") or {}
                result = self.handle_tools_call(tool_name, arguments)
            else:
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": _METHOD_NOT_FOUND, "message": f"Method not found: {method!r}"},
                }
        except Exception as exc:  # noqa: BLE001
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {"code": _INTERNAL_ERROR, "message": str(exc)},
            }

        return {"jsonrpc": "2.0", "id": req_id, "result": result}

    # ------------------------------------------------------------------
    # stdio loop
    # ------------------------------------------------------------------

    def run(
        self,
        stdin=None,
        stdout=None,
    ) -> None:
        """Read JSON-RPC requests from stdin, write responses to stdout."""
        inp = stdin or sys.stdin
        out = stdout or sys.stdout
        for line in inp:
            line = line.strip()
            if not line:
                continue
            try:
                request = json.loads(line)
            except json.JSONDecodeError:
                response = {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {"code": -32700, "message": "Parse error"},
                }
                out.write(json.dumps(response) + "\n")
                out.flush()
                continue
            response = self.dispatch(request)
            if response is not None:
                out.write(json.dumps(response) + "\n")
                out.flush()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    Base120Server().run()


if __name__ == "__main__":
    main()
