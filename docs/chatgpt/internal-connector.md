# Internal ChatGPT Connector — mcp.hummbl.io

## Purpose

This guide shows how to mount the production HUMMBL MCP server as a ChatGPT developer-mode connector for internal testing.

## Prerequisites

- ChatGPT account with developer mode access
- HUMMBL Cloudflare Access account (`reuben@hummbl.io` or other allowed email)
- Production MCP server live at `https://mcp.hummbl.io/mcp`

## Setup steps

### 1. Enable developer mode

In ChatGPT:
1. Go to **Settings → Apps & Connectors → Advanced settings**
2. Enable **developer mode**

### 2. Create the connector

1. Go to **Settings → Connectors → Create**
2. Add connector metadata:
   - **Name:** `HUMMBL MCP`
   - **Description:** `Search and reason over HUMMBL Base120 mental models and transformations.`
   - **Connector URL:** `https://mcp.hummbl.io/mcp`

### 3. Authentication

The connector will hit `https://mcp.hummbl.io/mcp` which is protected by Cloudflare Access. The auth flow:

1. ChatGPT connector sends request to `mcp.hummbl.io/mcp`
2. Cloudflare Access intercepts → redirects to login
3. User authenticates via OTP (email-based)
4. Access injects `CF-Access-Jwt-Assertion` header + `CF_Authorization` cookie
5. Worker verifies JWT, fetches groups, resolves profile
6. MCP session established

**Important:** Do not paste JWTs, cookies, or service tokens into ChatGPT prompts. The auth flow must happen through the connector's own HTTP session.

### 4. Verify the connection

Start a new chat with the connector enabled and ask:

```
Use the HUMMBL MCP connector and list available tools.
```

Expected: ChatGPT should call `tools/list` and report 12 tools (if your account is in `hummbl-mcp-write`) or 9 read-only tools.

### 5. Test prompts

| Prompt | Expected tool call |
|--------|-------------------|
| "List all HUMMBL models" | `list_all_models` |
| "Get model P1" | `get_model` with code `P1` |
| "Search for models about 'belonging'" | `search_models` with query `belonging` |
| "Recommend models for improving team psychological safety" | `recommend_models` |
| "What is the P transformation?" | `get_transformation` with key `P` |

## Current tool inventory

### Read-only tools (available to all authenticated users)

| Tool | Description |
|------|-------------|
| `get_model` | Get a mental model by code (e.g., P1) |
| `list_all_models` | List all 120 Base120 models |
| `search_models` | Search models by keyword |
| `get_transformation` | Get transformation details (P/IN/CO/DE/RE/SY) |
| `search_problem_patterns` | Search problem patterns |
| `recommend_models` | Recommend models for a problem description |
| `get_related_models` | Get models related to a specific model |
| `get_model_relationships` | Get relationships for a model |
| `find_relationship_path` | Find path between two models |
| `get_relationship_neighborhood` | Get relationship neighborhood |
| `get_recommendation_history` | Get past recommendation calls |
| `get_methodology` | Get Self-Dialectical AI methodology |

### Write tools (full profile only — `hummbl-mcp-write` group)

| Tool | Description |
|------|-------------|
| `add_relationship` | Add a relationship between two models |
| `export_models` | Export models as markdown/JSON/PDF |
| `list_workflows` | List guided workflows |
| `start_workflow` | Start a guided workflow |
| `continue_workflow` | Advance a workflow to the next step |
| `find_workflow_for_problem` | Find workflows matching a problem |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Connector can't connect | Access redirect not handled | Ensure the connector follows the OAuth/redirect flow |
| 406 Not Acceptable | Missing Accept header | Connector must send `Accept: application/json, text/event-stream` |
| 401 missing_token | No JWT | Complete the Access login flow first |
| Only 9 tools visible | Not in `hummbl-mcp-write` group | Contact operator to be added to the group |

## Public endpoints (no auth needed)

| Endpoint | URL |
|----------|-----|
| Health check | `https://mcp.hummbl.io/health` |
| Protected resource metadata | `https://mcp.hummbl.io/.well-known/oauth-protected-resource` |

## References

- [Apps SDK Quickstart](https://developers.openai.com/apps-sdk/quickstart)
- [Connect from ChatGPT](https://developers.openai.com/apps-sdk/deploy/connect-chatgpt)
- [Client connection guide](../mcp/client-connection.md)
- [Auth docs](../auth.md)
