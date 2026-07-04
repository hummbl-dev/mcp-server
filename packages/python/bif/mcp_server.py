#!/usr/bin/env python3
"""MCP Server for the Batch Ingestion Framework (BIF).

Exposes BIF methodology tools (session management, templates, validation,
status tracking) as MCP tools via stdio JSON-RPC.

Zero third-party dependencies. Uses only Python stdlib.

Usage:
    python3 mcp_server.py

Configure in Claude Code settings.json:
    {
      "mcpServers": {
        "bif": {
          "command": "python3",
          "args": ["/Users/others/PROJECTS/bif/mcp_server.py"]
        }
      }
    }
"""

import json
import sys
import tempfile
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SERVER_NAME = "bif"
SERVER_VERSION = "0.1.0"
PROTOCOL_VERSION = "2024-11-05"

TEMPLATE_DIR_CANDIDATES = (
    Path(__file__).parent / "templates",
    Path.cwd() / "templates",
    Path(sys.prefix) / "templates",
)
SESSIONS_DIR = Path(tempfile.gettempdir()) / "bif-sessions"

import os as _os
_env_sessions = _os.environ.get("BIF_SESSIONS_DIR")
if _env_sessions:
    SESSIONS_DIR = Path(_env_sessions)

# ---------------------------------------------------------------------------
# BIF Phase Definitions (from FRAMEWORK.md)
# ---------------------------------------------------------------------------
PHASES = {
    1: {
        "name": "FOUNDATION",
        "description": "Domain orientation -- what it is, how it works, what's current",
        "batches": {
            1: {"name": "Core Reference", "what_to_capture": "Official API/product docs, llms.txt or equivalent, site map of all available documentation", "priority": "Critical"},
            2: {"name": "Protocol / Architecture", "what_to_capture": "How the system works under the hood -- architecture, data flow, core abstractions", "priority": "Critical"},
            3: {"name": "Tooling Docs", "what_to_capture": "CLI tools, SDKs, IDE integrations, developer experience layer", "priority": "Critical"},
            4: {"name": "Delta Document", "what_to_capture": "What's changed recently -- new features, deprecations, migration guides, breaking changes vs. your current knowledge", "priority": "Critical"},
        },
        "exit_criteria": "You can explain the product's architecture, use its primary API, and know what's current vs. outdated.",
    },
    2: {
        "name": "TECHNIQUE",
        "description": "Methods and mastery -- how to use it well, how to avoid mistakes, what the experts think",
        "batches": {
            5: {"name": "Best Practices", "what_to_capture": "Official best practices, techniques, patterns. The 'how to use this well' docs.", "priority": "High"},
            6: {"name": "Production Hardening", "what_to_capture": "Guardrails, error handling, security, reliability, monitoring. The 'don't ship without this' docs.", "priority": "High"},
            7: {"name": "Thought Leadership", "what_to_capture": "Engineering blog posts, conference talks, case studies. How the creators think about their product.", "priority": "High"},
        },
        "exit_criteria": "You can build production-quality implementations and articulate why certain patterns work better than others.",
    },
    3: {
        "name": "SOURCE",
        "description": "Study the creators -- primary sources, documentation, actual usage",
        "batches": {
            8: {"name": "Production Configs", "what_to_capture": "System prompts, default configurations, internal settings the creators actually use", "priority": "Medium-High"},
            9: {"name": "Code Repositories", "what_to_capture": "What repos to clone, directory structures, key files, how to use them", "priority": "Medium-High"},
            10: {"name": "Research & Philosophy", "what_to_capture": "Why the product works this way -- research papers, design decisions, safety frameworks, model cards", "priority": "Medium"},
        },
        "exit_criteria": "You understand not just how to use it, but why it was built this way and how the creators use it themselves.",
    },
    4: {
        "name": "ECOSYSTEM",
        "description": "Expand outward -- community, tools, integrations, competitive context",
        "batches": {
            11: {"name": "Cookbooks & Deep-Dives", "what_to_capture": "Hands-on implementations, notebooks, worked examples", "priority": "As needed"},
            12: {"name": "Integrations & Ecosystem", "what_to_capture": "Complementary tools, plugins, server galleries, partner docs", "priority": "As needed"},
            13: {"name": "Consumer/Product Docs", "what_to_capture": "End-user documentation, pricing, plans, feature availability", "priority": "As needed"},
            14: {"name": "Community Analysis", "what_to_capture": "Expert commentary, benchmarks, comparisons, leaked internals", "priority": "As needed"},
            15: {"name": "Competitive Context", "what_to_capture": "How this compares to alternatives -- for positioning and decision-making", "priority": "As needed"},
        },
        "exit_criteria": "You can operate as a subject matter expert, make architectural decisions, create content, and advise others.",
    },
}

# Batch execution protocol steps (from FRAMEWORK.md Section 1.3)
BATCH_EXECUTION_STEPS = [
    "IDENTIFY sources (search for official docs, llms.txt, sitemaps)",
    "FETCH content (web_fetch, web_search, or manual copy)",
    "EXTRACT key information (concepts, code patterns, architecture, changes)",
    "COMPILE into a clean knowledge file (markdown, structured, searchable)",
    "VALIDATE coverage (does this batch answer all its intended questions?)",
    "DELIVER as uploadable knowledge file with metadata header",
]

# Quality checklist items (from FRAMEWORK.md Section 3.3)
QUALITY_CHECKS = [
    {"id": "metadata", "label": "Metadata header present (source URL, fetch date, purpose)"},
    {"id": "structured", "label": "Structured with headers -- scannable, any section findable in 10 seconds"},
    {"id": "code_examples", "label": "Code examples included where applicable (current model IDs and syntax)"},
    {"id": "tables", "label": "Tables for comparisons (models, features, pricing, options)"},
    {"id": "no_stale", "label": "No stale information (model names, API endpoints, features all current)"},
    {"id": "sitemap", "label": "Site map captured if this is a docs source"},
    {"id": "delta", "label": "Delta noted -- what's new vs. what a reader might already know"},
    {"id": "actionable", "label": "Actionable -- a developer could use this to start building immediately"},
    {"id": "self_contained", "label": "Self-contained -- usable without opening external links"},
    {"id": "token_budget", "label": "Under context budget (target: under 50K tokens per file)"},
]

# Source priority hierarchy (from FRAMEWORK.md Section 1.5)
SOURCE_PRIORITY = [
    "llms-full.txt / llms.txt -- purpose-built for LLM ingestion",
    "Official documentation (docs.*, platform.*, code.*)",
    "API reference pages -- exact parameters, schemas, examples",
    "Engineering blog posts -- from the company's own team",
    "GitHub repositories -- READMEs, changelogs, key source files",
    "Model/system cards -- capabilities, limitations, safety",
    "Release notes / changelogs -- what's new, what's deprecated",
    "Community analysis -- expert blogs, teardowns, benchmarks",
    "Press coverage / Wikipedia -- context, timeline, positioning",
    "Forum discussions -- edge cases, gotchas, real-world experience",
]


# ---------------------------------------------------------------------------
# Template loading
# ---------------------------------------------------------------------------
def _parse_template_description(content):
    """Extract description from a BIF template's heading."""
    for line in content.splitlines():
        if line.startswith("# BIF Template:"):
            return line.replace("# BIF Template:", "").strip()
    return ""


def _parse_template_batches(content):
    """Parse batch table rows from a BIF template."""
    batches = []
    for line in content.splitlines():
        if not line.startswith("|") or line.startswith("| Batch") or line.startswith("|---"):
            continue
        parts = [p.strip() for p in line.split("|")[1:-1]]
        if len(parts) >= 4:
            batches.append({
                "batch": parts[0], "phase": parts[1],
                "name": parts[2], "sources": parts[3],
            })
    return batches


def load_templates():
    """Load domain templates from the templates/ directory."""
    templates = {}
    templates_dir = next((path for path in TEMPLATE_DIR_CANDIDATES if path.exists()), None)
    if templates_dir is None:
        return templates
    for f in sorted(templates_dir.iterdir()):
        if f.suffix != ".md":
            continue
        content = f.read_text()
        templates[f.stem] = {
            "name": f.stem,
            "description": _parse_template_description(content),
            "file": str(f),
            "batches": _parse_template_batches(content),
            "raw": content,
        }
    return templates


# ---------------------------------------------------------------------------
# Session management
# ---------------------------------------------------------------------------
def _ensure_sessions_dir():
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)


def _session_path(session_id):
    return SESSIONS_DIR / f"{session_id}.json"


def _load_session(session_id):
    path = _session_path(session_id)
    if not path.exists():
        return None
    return json.loads(path.read_text())


def _save_session(session):
    _ensure_sessions_dir()
    path = _session_path(session["session_id"])
    path.write_text(json.dumps(session, indent=2))


def _get_phase_for_batch(batch_num):
    """Return the phase number for a given batch number."""
    if 1 <= batch_num <= 4:
        return 1
    elif 5 <= batch_num <= 7:
        return 2
    elif 8 <= batch_num <= 10:
        return 3
    else:
        return 4


def _get_batch_info(phase_num, batch_num):
    """Get batch metadata from the phase definitions."""
    phase = PHASES.get(phase_num)
    if not phase:
        return None
    return phase["batches"].get(batch_num)


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------
def tool_bif_start_session(arguments):
    """Initialize a new BIF ingestion session."""
    domain = arguments.get("domain", "Unknown Domain")
    target_batches = arguments.get("target_batches", 10)

    session_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()

    session = {
        "session_id": session_id,
        "domain": domain,
        "target_batches": target_batches,
        "created_at": now,
        "updated_at": now,
        "completed_batches": [],
        "current_phase": 1,
        "current_batch": 1,
        "notes": [],
    }
    _save_session(session)

    # Build Phase 1 prompt template
    phase1 = PHASES[1]
    batch1 = phase1["batches"][1]

    prompt_template = (
        f"# BIF Session: {domain}\n"
        f"## Phase 1: {phase1['name']} -- {phase1['description']}\n"
        f"### Batch 1: {batch1['name']}\n\n"
        f"**What to capture:** {batch1['what_to_capture']}\n\n"
        f"**Priority:** {batch1['priority']}\n\n"
        f"**Execution steps:**\n"
    )
    for i, step in enumerate(BATCH_EXECUTION_STEPS, 1):
        prompt_template += f"{i}. {step}\n"

    prompt_template += (
        "\n**Source priority (use this order):**\n"
    )
    for i, src in enumerate(SOURCE_PRIORITY, 1):
        prompt_template += f"{i}. {src}\n"

    prompt_template += (
        f"\n**Knowledge file format:** `01_{domain.replace(' ', '_')}_Core_Reference.md`\n"
        f"**Token budget:** Target under 50K tokens per file\n"
    )

    # Pre-ingestion checklist
    pre_checklist = [
        f"Identify the llms.txt for {domain}",
        "Map the docs site structure (full navigation/sitemap)",
        "Check for API primer or LLM-optimized summary docs",
        "Identify the changelog/release notes location",
        "Find the engineering blog",
        "Locate code repositories",
        "Check for system cards/model cards",
        "Identify the SDK(s)",
        "Note rate limits / access requirements",
        "Assess documentation freshness",
    ]

    return {
        "session_id": session_id,
        "domain": domain,
        "target_batches": target_batches,
        "created_at": now,
        "phase_1_prompt": prompt_template,
        "pre_ingestion_checklist": pre_checklist,
        "phases_overview": {
            str(k): {"name": v["name"], "description": v["description"]}
            for k, v in PHASES.items()
        },
    }


def tool_bif_get_template(arguments):
    """Get the prompt template for a specific phase and batch."""
    phase_num = arguments.get("phase")
    batch_num = arguments.get("batch_number")

    if phase_num not in PHASES:
        return {"error": f"Invalid phase: {phase_num}. Must be 1-4."}

    phase = PHASES[phase_num]
    batch_info = phase["batches"].get(batch_num)

    if not batch_info:
        valid = sorted(phase["batches"].keys())
        return {"error": f"Batch {batch_num} not found in Phase {phase_num}. Valid batches: {valid}"}

    # Build the template
    template = {
        "phase": phase_num,
        "phase_name": phase["name"],
        "phase_description": phase["description"],
        "batch_number": batch_num,
        "batch_name": batch_info["name"],
        "what_to_capture": batch_info["what_to_capture"],
        "priority": batch_info["priority"],
        "exit_criteria": phase["exit_criteria"],
        "execution_steps": BATCH_EXECUTION_STEPS,
        "quality_checks": QUALITY_CHECKS,
        "file_naming": f"{batch_num:02d}_[Domain]_{batch_info['name'].replace(' ', '_').replace('/', '_')}.md",
        "knowledge_file_header": (
            f"# [Domain] -- {batch_info['name']}\n"
            f"> Source: [primary URL(s)]\n"
            f"> Fetched: [date]\n"
            f"> Purpose: {batch_info['what_to_capture']}\n"
            f"\n---\n"
        ),
        "prompt": (
            f"You are executing BIF Batch {batch_num:02d} (Phase {phase_num}: {phase['name']}).\n\n"
            f"**Batch: {batch_info['name']}**\n"
            f"**Objective:** {batch_info['what_to_capture']}\n\n"
            f"Follow this execution protocol:\n"
            + "".join(f"  {i}. {step}\n" for i, step in enumerate(BATCH_EXECUTION_STEPS, 1))
            + f"\nExit criteria for this phase: {phase['exit_criteria']}\n"
            + "\nDeliver the result as a markdown knowledge file named: "
            + f"`{batch_num:02d}_[Domain]_{batch_info['name'].replace(' ', '_').replace('/', '_')}.md`"
        ),
    }

    # Add source priority for Phase 1
    if phase_num == 1:
        template["source_priority"] = SOURCE_PRIORITY

    return template


def _check_metadata(content):
    """Check for metadata header (Source, Fetched, Purpose)."""
    lower = content.lower()
    fields = {
        "Source": "> Source:" in content or "> source:" in lower,
        "Fetched": "> Fetched:" in content or "> fetched:" in lower,
        "Purpose": "> Purpose:" in content or "> purpose:" in lower,
    }
    all_present = all(fields.values())
    missing = [k for k, v in fields.items() if not v]
    detail = "Requires > Source:, > Fetched:, > Purpose: lines"
    if not all_present:
        detail += f" -- missing: {', '.join(missing)}"
    return {"check": "metadata", "passed": all_present, "detail": detail}


def _check_structure(lines):
    """Check for sufficient section headers."""
    count = sum(1 for line in lines if line.startswith("## "))
    return {"check": "structured", "passed": count >= 2,
            "detail": f"Found {count} ## headers (minimum 2 required)"}


def _check_code_examples(content):
    """Check for code blocks."""
    blocks = content.count("```")
    ok = blocks >= 2
    suffix = " (acceptable)" if ok else " (consider adding examples)"
    return {"check": "code_examples", "passed": ok,
            "detail": f"Found {blocks // 2} code blocks{suffix}"}


def _check_tables(lines):
    """Check for comparison tables."""
    rows = sum(1 for line in lines if line.strip().startswith("|") and "|" in line[1:])
    ok = rows >= 3
    suffix = " (acceptable)" if ok else " (consider adding comparison tables)"
    return {"check": "tables", "passed": ok,
            "detail": f"Found {rows} table rows{suffix}"}


def _check_sitemap(content):
    """Check for site map reference (Phase 1 only)."""
    lower = content.lower()
    ok = "site map" in lower or "sitemap" in lower or "navigation" in lower
    suffix = " -- found" if ok else " -- missing"
    return {"check": "sitemap", "passed": ok,
            "detail": f"Phase 1 should include documentation site map{suffix}"}


def _check_references(content):
    """Check for URL references."""
    count = content.count("http://") + content.count("https://")
    return {"check": "references", "passed": count > 0,
            "detail": f"Found {count} URLs for reference"}


def _check_token_budget(content):
    """Check estimated token count is under 50K."""
    tokens = len(content) // 4
    ok = tokens < 50000
    suffix = " (under 50K limit)" if ok else " (OVER 50K limit -- split into sub-batches)"
    return {"check": "token_budget", "passed": ok,
            "detail": f"~{tokens:,} estimated tokens{suffix}"}


def _check_title(lines):
    """Check for a title heading."""
    ok = any(line.startswith("# ") for line in lines)
    detail = "Knowledge file has a title heading" if ok else "Missing # title heading"
    return {"check": "title", "passed": ok, "detail": detail}


def _check_formatting(content):
    """Check for horizontal rule separators."""
    ok = "---" in content
    detail = ("Has horizontal rules for section separation" if ok
              else "Consider adding --- separators between major sections")
    return {"check": "formatting", "passed": ok, "detail": detail}


def tool_bif_validate_batch(arguments):
    """Validate a completed batch against BIF quality criteria."""
    batch_content = arguments.get("batch_content", "")
    phase_num = arguments.get("phase")
    batch_num = arguments.get("batch_number")

    if not batch_content:
        return {"error": "batch_content is required"}

    lines = batch_content.splitlines()

    # Run all checks
    checks = [
        _check_metadata(batch_content),
        _check_structure(lines),
        _check_code_examples(batch_content),
        _check_tables(lines),
    ]
    if phase_num == 1:
        checks.append(_check_sitemap(batch_content))
    checks.extend([
        _check_references(batch_content),
        _check_token_budget(batch_content),
        _check_title(lines),
        _check_formatting(batch_content),
    ])

    passed = sum(1 for c in checks if c["passed"])
    failed = len(checks) - passed

    return {
        "overall": "PASS" if failed == 0 else "FAIL",
        "passed": passed,
        "failed": failed,
        "total_checks": len(checks),
        "score": f"{passed}/{len(checks)}",
        "phase": phase_num,
        "batch_number": batch_num,
        "checks": checks,
        "gaps": [c["detail"] for c in checks if not c["passed"]],
    }


def _list_all_sessions():
    """Return summary of all BIF sessions."""
    _ensure_sessions_dir()
    sessions = []
    for f in sorted(SESSIONS_DIR.iterdir()):
        if f.suffix == ".json":
            s = json.loads(f.read_text())
            sessions.append({
                "session_id": s["session_id"],
                "domain": s["domain"],
                "created_at": s["created_at"],
                "completed": len(s.get("completed_batches", [])),
                "target": s["target_batches"],
            })
    return {"sessions": sessions, "count": len(sessions)}


def _compute_phase_coverage(completed, target):
    """Compute per-phase completion coverage."""
    coverage = {}
    for phase in PHASES.values():
        relevant = [b for b in phase["batches"] if b <= target]
        done = [b for b in relevant if b in completed]
        coverage[phase["name"]] = {
            "total": len(relevant),
            "completed": len(done),
            "remaining": [b for b in relevant if b not in completed],
            "exit_criteria": phase["exit_criteria"],
            "exit_met": len(done) == len(relevant) and len(relevant) > 0,
        }
    return coverage


def _find_next_batch(completed, target):
    """Find the next incomplete batch and return its info."""
    for b in range(1, target + 1):
        if b not in completed:
            phase_num = _get_phase_for_batch(b)
            batch_info = _get_batch_info(phase_num, b)
            if batch_info:
                return {
                    "batch_number": b,
                    "phase": phase_num,
                    "phase_name": PHASES[phase_num]["name"],
                    "name": batch_info["name"],
                    "what_to_capture": batch_info["what_to_capture"],
                }
    return None


def tool_bif_session_status(arguments):
    """Check progress of a BIF session."""
    session_id = arguments.get("session_id")
    if not session_id:
        return _list_all_sessions()

    session = _load_session(session_id)
    if not session:
        return {"error": f"Session not found: {session_id}"}

    completed = session.get("completed_batches", [])
    target = session["target_batches"]

    return {
        "session_id": session_id,
        "domain": session["domain"],
        "created_at": session["created_at"],
        "target_batches": target,
        "completed_batches": completed,
        "completion": f"{len(completed)}/{target}",
        "percentage": round(len(completed) / target * 100) if target > 0 else 0,
        "phase_coverage": _compute_phase_coverage(completed, target),
        "next_batch": _find_next_batch(completed, target),
        "notes": session.get("notes", []),
    }


def tool_bif_list_templates(arguments):
    """List available domain templates."""
    templates = load_templates()

    result = []
    for key, tmpl in templates.items():
        result.append({
            "template_id": key,
            "description": tmpl["description"],
            "file": tmpl["file"],
            "batch_count": len(tmpl["batches"]),
            "batches": tmpl["batches"],
        })

    # Also include the generic BIF phases as a "generic" template
    generic_batches = []
    for phase_num, phase in PHASES.items():
        for batch_num, batch in phase["batches"].items():
            generic_batches.append({
                "batch": str(batch_num),
                "phase": phase["name"],
                "name": batch["name"],
                "sources": batch["what_to_capture"][:60] + "...",
            })

    result.append({
        "template_id": "generic",
        "description": "Generic BIF template (all 4 phases, 15 batches)",
        "file": None,
        "batch_count": len(generic_batches),
        "batches": generic_batches,
    })

    return {"templates": result, "count": len(result)}


# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------
TOOLS = [
    {
        "name": "bif_start_session",
        "description": "Initialize a new BIF ingestion session. Returns session_id, Phase 1 prompt template, and pre-ingestion checklist.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "domain": {
                    "type": "string",
                    "description": "The domain to ingest (e.g., 'Anthropic ecosystem', 'AWS Lambda', 'React')",
                },
                "target_batches": {
                    "type": "integer",
                    "description": "Number of batches to plan (default: 10, max: 15)",
                    "default": 10,
                },
            },
            "required": ["domain"],
        },
    },
    {
        "name": "bif_get_template",
        "description": "Get the prompt template for a specific BIF phase and batch. Returns structured prompt with execution steps, quality checks, and file naming conventions.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "phase": {
                    "type": "integer",
                    "description": "Phase number (1=Foundation, 2=Technique, 3=Source, 4=Ecosystem)",
                    "enum": [1, 2, 3, 4],
                },
                "batch_number": {
                    "type": "integer",
                    "description": "Batch number (1-15)",
                },
            },
            "required": ["phase", "batch_number"],
        },
    },
    {
        "name": "bif_validate_batch",
        "description": "Validate a completed batch against BIF quality criteria. Checks metadata header, structure, code examples, tables, token budget, and more.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "batch_content": {
                    "type": "string",
                    "description": "The full markdown content of the completed batch knowledge file",
                },
                "phase": {
                    "type": "integer",
                    "description": "Phase number (1-4)",
                },
                "batch_number": {
                    "type": "integer",
                    "description": "Batch number",
                },
            },
            "required": ["batch_content", "phase", "batch_number"],
        },
    },
    {
        "name": "bif_session_status",
        "description": "Check progress of a BIF session. Without session_id, lists all sessions. With session_id, shows detailed progress including phase coverage and next batch.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "session_id": {
                    "type": "string",
                    "description": "Session ID to check (omit to list all sessions)",
                },
            },
            "required": [],
        },
    },
    {
        "name": "bif_list_templates",
        "description": "List available BIF domain templates (AI/ML Platform, Cloud Platform, Programming Framework, SaaS Evaluation, and the generic template).",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
]

# Tool dispatch map
TOOL_HANDLERS = {
    "bif_start_session": tool_bif_start_session,
    "bif_get_template": tool_bif_get_template,
    "bif_validate_batch": tool_bif_validate_batch,
    "bif_session_status": tool_bif_session_status,
    "bif_list_templates": tool_bif_list_templates,
}


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


def _handle_initialize(msg_id):
    """Handle MCP initialize request."""
    send_response(msg_id, {
        "protocolVersion": PROTOCOL_VERSION,
        "capabilities": {"tools": {}},
        "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
    })


def _handle_tools_call(msg_id, params):
    """Handle MCP tools/call request."""
    tool_name = params.get("name", "")
    arguments = params.get("arguments", {})
    handler = TOOL_HANDLERS.get(tool_name)
    result = handler(arguments) if handler else {"error": f"Unknown tool: {tool_name}"}
    send_response(msg_id, {
        "content": [
            {"type": "text", "text": json.dumps(result, indent=2, default=str)}
        ],
    })


# Method dispatch table
_METHOD_HANDLERS = {
    "initialize": lambda msg_id, _params: _handle_initialize(msg_id),
    "notifications/initialized": lambda _msg_id, _params: None,
    "tools/list": lambda msg_id, _params: send_response(msg_id, {"tools": TOOLS}),
    "tools/call": lambda msg_id, params: _handle_tools_call(msg_id, params),
    "ping": lambda msg_id, _params: send_response(msg_id, {}),
}


def main():
    """Main stdio JSON-RPC loop implementing MCP protocol."""
    _ensure_sessions_dir()

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
            handler = _METHOD_HANDLERS.get(method)
            if handler:
                handler(msg_id, params)
            else:
                send_error(msg_id, -32601, f"Method not found: {method}")
        except Exception as e:
            send_error(
                msg_id, -32603,
                f"Internal error: {e}\n{traceback.format_exc()}",
            )


if __name__ == "__main__":
    main()
