# HUMMBL MCP Server — Client Setup Guide

This guide covers all ways to connect MCP clients to HUMMBL MCP servers.

## Table of Contents

1. [Transports](#transports)
2. [Local (stdio) Setup](#local-stdio-setup)
3. [Remote (Streamable HTTP) Setup](#remote-streamable-http-setup)
4. [Bridging stdio-only Clients to Remote](#bridging-stdio-only-clients-to-remote)
5. [Client Configuration Reference](#client-configuration-reference)

---

## Transports

HUMMBL MCP servers support two transports:

| Transport | Use case | Clients |
|-----------|----------|---------|
| **stdio** | Local subprocess (Claude Desktop, CLI) | All clients |
| **Streamable HTTP** | Remote deployment (mcp.hummbl.io) | Claude Desktop, Claude Code, Cursor, VS Code, Windsurf |

---

## Local (stdio) Setup

All HUMMBL MCP servers support stdio transport. Install the package and configure your client.

### TypeScript server (`@hummbl/mcp-server`)

```bash
npm install -g @hummbl/mcp-server
```

### Python servers (via uvx or pip)

```bash
# Install any HUMMBL Python MCP server
pip install hummbl-governance-mcp
pip install hummbl-compliance-mcp
# etc.
```

---

## Remote (Streamable HTTP) Setup

The TypeScript server is deployed at `https://mcp.hummbl.io/mcp` using Cloudflare Workers with the MCP Streamable HTTP transport.

---

## Bridging stdio-only Clients to Remote

If your client only supports stdio (e.g., older Claude Desktop versions), use `mcp-remote` to bridge to the remote HTTP endpoint:

```json
{
  "mcpServers": {
    "hummbl-remote": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.hummbl.io/mcp"]
    }
  }
}
```

---

## Client Configuration Reference

### Claude Desktop

**Config file location**:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Local (stdio)**:
```json
{
  "mcpServers": {
    "hummbl-base120": {
      "command": "hummbl-mcp"
    }
  }
}
```

**Remote (Streamable HTTP)** — via custom connector (Claude Desktop 2025.06+):
```json
{
  "mcpServers": {
    "hummbl-remote": {
      "type": "http",
      "url": "https://mcp.hummbl.io/mcp"
    }
  }
}
```

**Remote (bridged via mcp-remote)** — for older Claude Desktop:
```json
{
  "mcpServers": {
    "hummbl-remote": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.hummbl.io/mcp"]
    }
  }
}
```

---

### Claude Code

**Config file**: `.mcp.json` in project root (project-scoped) or `~/.claude/mcp.json` (global)

**Local (stdio)**:
```json
{
  "mcpServers": {
    "hummbl-base120": {
      "command": "hummbl-mcp"
    }
  }
}
```

**Remote (Streamable HTTP)**:
```json
{
  "mcpServers": {
    "hummbl-remote": {
      "type": "http",
      "url": "https://mcp.hummbl.io/mcp"
    }
  }
}
```

**With authentication** (when OAuth is enabled):
```json
{
  "mcpServers": {
    "hummbl-remote": {
      "type": "http",
      "url": "https://mcp.hummbl.io/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

---

### Cursor

**Config file**: `.cursor/mcp.json` in project root

**Local (stdio)**:
```json
{
  "mcpServers": {
    "hummbl-base120": {
      "command": "hummbl-mcp"
    }
  }
}
```

**Remote (Streamable HTTP)**:
```json
{
  "mcpServers": {
    "hummbl-remote": {
      "url": "https://mcp.hummbl.io/mcp"
    }
  }
}
```

---

### VS Code

**Config file**: `.vscode/mcp.json` in project root

**Local (stdio)**:
```json
{
  "servers": {
    "hummbl-base120": {
      "command": "hummbl-mcp"
    }
  }
}
```

**Remote (Streamable HTTP)**:
```json
{
  "servers": {
    "hummbl-remote": {
      "url": "https://mcp.hummbl.io/mcp"
    }
  }
}
```

**With secrets** (VS Code supports `inputs` for secret management):
```json
{
  "servers": {
    "hummbl-remote": {
      "url": "https://mcp.hummbl.io/mcp",
      "headers": {
        "Authorization": "Bearer ${input:hummbl-token}"
      }
    }
  },
  "inputs": [
    {
      "id": "hummbl-token",
      "type": "promptString",
      "description": "HUMMBL MCP API token",
      "password": true
    }
  ]
}
```

---

### Windsurf

**Config file**: `mcp_config.json` (global only, no project-scoped config)

**Local (stdio)**:
```json
{
  "mcpServers": {
    "hummbl-base120": {
      "command": "hummbl-mcp"
    }
  }
}
```

**Remote (Streamable HTTP)**:
```json
{
  "mcpServers": {
    "hummbl-remote": {
      "serverUrl": "https://mcp.hummbl.io/mcp"
    }
  }
}
```

> **Note**: Windsurf uses `serverUrl` (not `url`) for remote servers.

---

### CLI (direct invocation)

**stdio mode** (default when run as subprocess):
```bash
hummbl-mcp --stdio
```

**HTTP mode** (standalone server):
```bash
hummbl-mcp --http --port 3000
```

**Auto-detect mode** (default):
```bash
hummbl-mcp  # serves stdio if stdin is piped, HTTP if stdin is a TTY
```

---

## Verifying Your Connection

After configuring your client, verify the connection:

1. **Check server health** (HTTP mode only):
   ```bash
   curl https://mcp.hummbl.io/health
   ```

2. **List available tools**:
   In your MCP client, call the `tools/list` method. You should see:
   - `select_model` — Select a Base120 mental model
   - `apply_transformation` — Apply a transformation to a problem
   - `analyze_problem` — Analyze a problem using mental models
   - `export_analysis` — Export an analysis as markdown/JSON

3. **List available resources**:
   Call `resources/list`. You should see:
   - `models://all` — All Base120 models
   - `models://by-transformation/{type}` — Models by transformation type

---

## Troubleshooting

### "Connection refused" or "ECONNREFUSED"
- For local servers: ensure the package is installed and the command is on PATH
- For remote servers: check your internet connection and that mcp.hummbl.io is reachable

### "Unauthorized" or "401"
- OAuth authentication may be required for remote servers
- Set up your token via the client's secret management (VS Code `inputs`, Claude Code `headers`)

### "Tool not found"
- Ensure you're connecting to the right server (Base120 vs governance vs compliance)
- Each server exposes different tools

### stdio server hangs
- stdio servers log to stderr, not stdout (stdout is reserved for MCP protocol)
- Check stderr for error messages

---

## See Also

- [MCP Access Patterns Research](../../docs/research/2026-06-23_mcp-access-patterns.md) — comprehensive research on all MCP access patterns
- [MCP Protocol Specification](https://modelcontextprotocol.io/specification) — official spec
- [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/) — deployment platform
