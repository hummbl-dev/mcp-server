# HUMMBL MCP Server

Model Context Protocol server providing access to the HUMMBL Base120 mental models framework.

<a href="https://glama.ai/mcp/servers/@hummbl-dev/mcp-server">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@hummbl-dev/mcp-server/badge" alt="HUMMBL Server MCP server" />
</a>

## Overview

HUMMBL Base120 is a comprehensive cognitive framework consisting of 120 validated mental models organized across 6 transformations:

- P (Perspective): Change viewpoint to see problems differently
- IN (Inversion): Flip problem to find solution by avoiding failure
- CO (Composition): Combine elements to create emergent properties
- DE (Decomposition): Break down complexity into manageable components
- RE (Recursion): Apply patterns at multiple scales and iterations
- SY (Meta-Systems): Understand rules, patterns, and systems governing systems

## Installation

### Global Installation (Recommended)

```bash
npm install -g @hummbl/mcp-server
```

### Using npx (No Installation Required)

```bash
npx @hummbl/mcp-server
```

## Configuration

### Claude Desktop

Add to your Claude Desktop configuration file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

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

After configuration, restart Claude Desktop. The HUMMBL tools will appear in the attachment menu.

## Available Tools

### `get_model`
Retrieve detailed information about a specific mental model.

Example:
```json
{
  "code": "P1"
}
```

### `list_all_models`
List all 120 mental models, optionally filtered by transformation type.

Example:
```json
{
  "transformation_filter": "P"
}
```

### `search_models`
Search models by keyword across names, descriptions, and examples.

Example:
```json
{
  "query": "decision"
}
```

### `recommend_models`
Get AI-recommended models based on problem description.

Example:
```json
{
  "problem_description": "Our startup is growing rapidly but systems are breaking down. We need to scale operations without losing quality."
}
```

### `get_transformation`
Retrieve information about a specific transformation type and all its models.

Example:
```json
{
  "type": "IN"
}
```

### `search_problem_patterns`
Find pre-defined problem patterns with recommended approaches.

Example:
```json
{
  "query": "innovation"
}
```

## Available Resources

Direct URI-based access to models and transformations:

- `hummbl://model/{code}` – Individual model (e.g., `hummbl://model/P1`)
- `hummbl://transformation/{type}` – All models in transformation (e.g., `hummbl://transformation/P`)
- `hummbl://models` – Complete Base120 framework

## Development

### Setup

```bash
git clone https://github.com/hummbl-dev/mcp-server.git
cd mcp-server
npm install
```

### Build

```bash
npm run build
```

### Run Locally

```bash
npm run dev
```

### Type Checking

```bash
npm run typecheck
```

## Architecture

```text
src/
├── index.ts              # stdio entry point
├── server.ts             # Server configuration
├── framework/
│   └── base120.ts        # Complete mental models database
├── tools/
│   └── models.ts         # Tool registrations
├── resources/
│   └── models.ts         # Resource endpoints
├── types/
│   └── domain.ts         # Core type definitions
└── utils/
    └── result.ts         # Result pattern utilities
```

## License

MIT © HUMMBL, LLC

## Version

1.0.0-beta.1