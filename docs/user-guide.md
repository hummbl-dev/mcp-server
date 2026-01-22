# HUMMBL MCP Server – User Guide

## 1. Purpose & Audience

This guide explains how strategists, operators, and engineers can install, configure, and operate the HUMMBL MCP Server to access the Base120 mental models and Self-Dialectical AI Systems methodology through Model Context Protocol (MCP) clients. Follow these steps to deliver consistent cognition support across Claude Desktop, IDE copilots, and internal tools.

## 2. Prerequisites

- Node.js 18+ and npm (preferred package manager)
- Network access to fetch npm packages
- An MCP-capable client (e.g., Claude Desktop, Perplexity Labs, VS Code MCP extension)
- HUMMBL Base120 familiarity (see `README.md` Overview)

## 3. Installation Options

| Scenario | Command | Notes |
| --- | --- | --- |
| Global install (recommended) | `npm install -g @hummbl/mcp-server` | Makes `hummbl-mcp` CLI available system-wide |
| On-demand | `npx @hummbl/mcp-server` | Pulls latest version without persistent install |
| Project dependency | `npm install @hummbl/mcp-server --save-dev` | Useful when bundling with bespoke tooling |

After installation, run `hummbl-mcp --help` to confirm availability.

## 4. Client Configuration

### 4.1 Claude Desktop (macOS & Windows)

1. Locate the config file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%/Claude/claude_desktop_config.json`
1. Add the HUMMBL entry (keep `npm`/`npx` consistent with installation):

```json
{
  "mcpServers": {
    "hummbl": {
      "command": "npx",
      "args": ["-y", "@hummbl/mcp-server"]
    }
  }
}
```

1. Restart Claude Desktop. HUMMBL tools appear under the attachments menu.

### 4.2 Perplexity or Other MCP-Aware Copilots

1. Consult the client's MCP settings UI.
1. Set command to `hummbl-mcp` (or `npx -y @hummbl/mcp-server`).
1. Choose stdio transport when asked; no API keys are required today.

### 4.3 VS Code / JetBrains Extensions

1. Install an MCP-compatible extension (e.g., Perplexity MCP for VS Code).
1. Register a new server pointing to `hummbl-mcp`.
1. Enable the extension. The HUMMBL tools become callable within the editor command palette.

### 4.4 Automation & CI Pipelines

Use the CLI directly inside scripts:

```bash
hummbl-mcp --transport stdio <<'EOF'
{"method":"hummbl/get_model","params":{"code":"DE3"}}
EOF
```

This enables batch audits of model references or automated methodology exports.

## 5. Using HUMMBL Tools (Base120)

| Tool | Purpose | Minimal Params |
| --- | --- | --- |
| `get_model` | Fetch a single model with description, example, tags | `{ "code": "P1" }` |
| `list_all_models` | Enumerate the 120 models or filter by transformation | `{ "transformation_filter": "IN" }` (optional) |
| `search_models` | Keyword search across names, descriptions, examples | `{ "query": "decision" }` |
| `recommend_models` | Receive recommendations based on a problem statement | `{ "problem_description": "Scaling ops" }` |
| `get_transformation` | Return all models within a transformation (P/IN/CO/DE/RE/SY) | `{ "type": "SY" }` |
| `search_problem_patterns` | Retrieve HUMMBL problem patterns plus suggested models | `{ "query": "ethics" }` |
| `get_methodology` | Download the Self-Dialectical AI methodology bundle | `{}` |
| `audit_model_references` | Validate lists of model references in briefs | `{ "items": [{"code": "IN11"}] }` |

> All responses follow the HUMMBL Result pattern with explicit `ok`/`error` fields. Handle errors by inspecting `error.code` and `error.message`.

## 6. Resources (URI Access)

- `hummbl://model/{code}`
- `hummbl://transformation/{type}`
- `hummbl://models`
- `hummbl://methodology/self-dialectical-ai`
- `hummbl://methodology/self-dialectical-ai/overview`

Clients that support MCP resources can fetch the canonical JSON/Markdown directly without invoking tools.

## 7. Troubleshooting Checklist

1. **Server will not start** – ensure Node.js 18+, run `npm install`, then retry `npx @hummbl/mcp-server`.
1. **Claude does not list HUMMBL tools** – confirm config JSON syntax, remove trailing commas, restart Claude Desktop.
1. **Tool errors referencing missing models** – run `get_model` with the exact code (e.g., `DE3`). The audit tool flags typos.
1. **Network restrictions** – preload the package (`npm pack @hummbl/mcp-server`) inside restricted environments.
1. Review `TROUBLESHOOTING.md` for deeper diagnostics and support escalation paths.

## 8. Operational Best Practices

- Pin server versions in regulated environments: `npx @hummbl/mcp-server@1.0.0-beta.2`.
- Log all tool invocations when integrating with internal platforms for post-incident reviews.
- Use HUMMBL transformations explicitly in prompts (e.g., "Use SY6 to evaluate meta-constraints").
- Pair HUMMBL outputs with human validation before high-stakes deployment.

## 9. Support & Feedback

- Issues: [GitHub issue tracker](https://github.com/hummbl-dev/mcp-server/issues)
- Security reporting: see `SECURITY.md`
- For feature requests or Base120 clarifications, contact Reuben (reuben@hummbl.io)

Stay aligned with HUMMBL Base120 principles and cite transformation codes in prompts for maximum fidelity.
