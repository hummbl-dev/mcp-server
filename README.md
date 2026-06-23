# HUMMBL MCP Servers

Monorepo for all HUMMBL Model Context Protocol (MCP) servers — TypeScript and Python.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

## Servers

### TypeScript

| Server | Package | Description |
|--------|---------|-------------|
| **Base120** | [`@hummbl/mcp-server`](https://www.npmjs.com/package/@hummbl/mcp-server) | HUMMBL Base120 mental models framework — 120 validated mental models across 6 cognitive transformations |

→ [`packages/ts/`](packages/ts/) — TypeScript server source, tests, and docs

### Python

| Server | Package | Description |
|--------|---------|-------------|
| **Base120** | `hummbl-mcp-base120` | MCP server exposing the Base120 engine (5 tools) |
| **BIF** | `hummbl-mcp-bif` | BIF methodology tools: session management, templates, validation, status tracking |
| **Governance** (7 servers) | `hummbl-mcp-governance` | 7 MCP servers exposing all HUMMBL governance primitives (32+ tools): governance, compliance, sandbox, identity, agent monitor, reasoning, physical AI |
| **UTF** | `hummbl-mcp-utf` | Unified Tier Framework: problem classification, model recommendation, tier assessment |

→ [`packages/python/`](packages/python/) — Python server sources

## Repository Structure

```
mcp-server/
  packages/
    ts/                  # TypeScript flagship server (@hummbl/mcp-server on npm)
      src/
      tests/
      package.json
      wrangler.toml
      docs/
      ...
    python/
      base120/           # hummbl-mcp-base120 (depends on base120 PyPI package)
        mcp_server.py
        pyproject.toml
        README.md
      bif/               # hummbl-mcp-bif (stdlib only)
        mcp_server.py
        pyproject.toml
        README.md
      governance/        # hummbl-mcp-governance (7 servers, depends on hummbl-governance PyPI package)
        mcp_server.py          # governance (kill switch, circuit breaker, cost governor, audit log)
        mcp_compliance.py      # compliance (NIST, SOC2, ISO, STRIDE)
        mcp_sandbox.py         # sandbox (capability fence, output validator)
        mcp_identity.py        # identity (agent registry, delegation tokens, lamport clock)
        mcp_agent_monitor.py   # agent monitor (behavior, convergence, lifecycle, evolution)
        mcp_reasoning.py       # reasoning (reasoning engine, schema validator, contract net)
        mcp_physical.py        # physical AI (kinematic governor, pHRI safety)
        pyproject.toml
        README.md
      utf/               # hummbl-mcp-utf (stdlib only)
        mcp_server.py
        pyproject.toml
        README.md
  docs/                  # shared docs (if any)
  scripts/               # shared scripts (if any)
  README.md              # this file
  LICENSE
  CODE_OF_CONDUCT.md
  CONTRIBUTING.md
```

## Install

### TypeScript server

```bash
npm install @hummbl/mcp-server
```

### Python servers

```bash
pip install hummbl-mcp-base120
pip install hummbl-mcp-bif
pip install hummbl-mcp-governance
pip install hummbl-mcp-utf
```

## Development

### TypeScript

```bash
cd packages/ts
npm install
npm run build
npm run dev
```

### Python

```bash
cd packages/python/base120
pip install -e .
hummbl-mcp-base120
```

For servers that depend on parent packages (`base120`, `hummbl-governance`), install the parent package in editable mode from a sibling repo:

```bash
pip install -e ../base120      # for hummbl-mcp-base120
pip install -e ../hummbl-governance  # for hummbl-mcp-governance
```

## Adding a New MCP Server

1. Create `packages/python/{name}/` (or `packages/ts/{name}/`)
2. Add `mcp_server.py` (or `index.ts`)
3. Add `pyproject.toml` (or `package.json`)
4. Add `README.md`
5. Update this root README's server table
6. Add CI workflow entry if needed

## License

Apache-2.0 — see [LICENSE](LICENSE)

## Related

- [hummbl-governance](https://github.com/hummbl-dev/hummbl-governance) — Python governance primitives
- [base120](https://github.com/hummbl-dev/base120) — Base120 mental models engine
- [hummbl.io](https://hummbl.io) — Main site

HUMMBL™ and BASE120™ are trademarks of HUMMBL, LLC.
