# hummbl-mcp-base120

MCP server exposing the HUMMBL Base120 mental models engine.

## Tools

- `base120_get` — look up an operator by code
- `base120_list` — list operators, optionally filtered by family
- `base120_families` — return the 6 canonical family codes
- `base120_prompt` — generate a system prompt for an operator + problem
- `base120_record` — record an operator application as a governance artifact

## Install

```bash
pip install hummbl-mcp-base120
```

## Run

```bash
hummbl-mcp-base120
```

Or via stdio JSON-RPC:

```bash
python -m mcp_server
```

## Dependencies

- `base120>=2.0.0` (from PyPI)

## License

Apache-2.0
