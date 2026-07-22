# HUMMBL ChatGPT App Plan

## Working name

```
HUMMBL Base120
```

## User promise

```
Turn messy problems into structured mental-model recommendations using HUMMBL Base120.
```

## Architecture

```
ChatGPT App (Apps SDK)
  ├── MCP server (mcp-public.hummbl.io/mcp)
  │     ├── Read-only tools (8 tools)
  │     └── No write tools exposed
  ├── Widget UI (rendered inside ChatGPT)
  │     ├── ModelCard
  │     ├── ModelRecommendationSet
  │     ├── TransformationMap
  │     ├── RelatedModelsGraph
  │     └── MethodologyPanel
  └── Auth (OAuth user sign-in)
        └── Separate from internal Cloudflare Access
```

## MCP server: mcp-public.hummbl.io

### New agent class

```typescript
export class HummblPublicMcpAgent extends McpAgent {
  server = new McpServer({
    name: "hummbl-mcp-public",
    version: SERVER_VERSION,
  });

  async init() {
    // Read-only tools only — no write tools, no export, no workflows
    registerPublicModelTools(this.server);   // 8 read-only tools
    registerMethodologyTools(this.server);   // methodology tools
  }
}
```

### Public read-only tools

| Tool | Description | Annotations |
|------|-------------|-------------|
| `get_model` | Get a mental model by code | `readOnlyHint: true` |
| `list_all_models` | List all 120 Base120 models | `readOnlyHint: true` |
| `search_models` | Search models by keyword | `readOnlyHint: true` |
| `get_transformation` | Get transformation details | `readOnlyHint: true` |
| `search_problem_patterns` | Search problem patterns | `readOnlyHint: true` |
| `recommend_models` | Recommend models for a problem | `readOnlyHint: true`, `openWorldHint: true` |
| `get_related_models` | Get related models | `readOnlyHint: true` |
| `get_methodology` | Get Self-Dialectical AI methodology | `readOnlyHint: true` |

### Excluded from public server

| Tool | Reason |
|------|--------|
| `add_relationship` | Write operation — internal only |
| `export_models` | Export — internal only |
| `get_recommendation_history` | User-specific data — internal only |
| `get_model_relationships` | May expose internal graph structure |
| `find_relationship_path` | May expose internal graph structure |
| `get_relationship_neighborhood` | May expose internal graph structure |
| `list_workflows` | Workflow tools — internal only |
| `start_workflow` | Write operation — internal only |
| `continue_workflow` | Write operation — internal only |
| `find_workflow_for_problem` | Internal workflow matching |

### Auth model

The public MCP server should **not** use Cloudflare Access (that's the internal/admin plane). Options:

1. **OAuth user sign-in** — Users authenticate via GitHub, Google, or email OTP
2. **Anonymous + rate-limited** — For initial launch, no auth but rate-limited per IP
3. **API key** — For programmatic access

Recommended: Start with **anonymous + rate-limited** for the MVP, add OAuth before public app submission.

### Wrangler config

```toml
# wrangler.mcp-public.toml
name = "hummbl-mcp-public"
main = "dist/mcp-public.js"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[[durable_objects.bindings]]
name = "MCP_OBJECT_PUBLIC"
class_name = "HummblPublicMcpAgent"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["HummblPublicMcpAgent"]

[[routes]]
pattern = "mcp-public.hummbl.io/*"
zone_name = "hummbl.io"

[vars]
ENVIRONMENT = "production"
MCP_RESOURCE_URL = "https://mcp-public.hummbl.io"
```

## Widget UI design

### ModelCard

Shows one Base120 model with:
- Code (e.g., P1)
- Name (e.g., First Principles Framing)
- Definition
- Priority (1-5)
- Transformation (P/IN/CO/DE/RE/SY)

```
┌─────────────────────────────────┐
│ P1 · First Principles Framing   │
│ Priority: 1 · Transformation: P │
│                                 │
│ Reduce complex problems to      │
│ foundational truths that cannot │
│ be further simplified            │
└─────────────────────────────────┘
```

### ModelRecommendationSet

Shows recommended models for a user's problem:
- Problem summary (truncated)
- Top 3-5 recommended models as ModelCards
- Recommended transformation sequence

### TransformationMap

Shows the 6 transformations with model counts:
- P (Framing) — 20 models
- IN (Inversion) — 20 models
- CO (Composition) — 20 models
- DE (Decomposition) — 20 models
- RE (Recursion) — 20 models
- SY (Synthesis) — 20 models

### RelatedModelsGraph

Shows model adjacency:
- Center: selected model
- Edges: related models with relationship types
- Interactive: click to navigate

### MethodologyPanel

Explains how recommendations were generated:
- Which transformations were selected
- Which problem pattern matched
- Confidence indicators

## Apps SDK metadata

### Server instructions

```
You are connected to the HUMMBL Base120 mental model system.
Use the tools to help users clarify problems, find relevant mental models,
and generate structured recommendations. Always explain which transformation
a model belongs to and why it's relevant to the user's problem.
```

### Tool metadata

Each tool should have:
- Clear `title` (human-readable)
- Concise `description` (what it does + when to use it)
- `outputSchema` (structured output for widget rendering)
- `annotations.readOnlyHint: true` (all public tools are read-only)
- `_meta.ui.resourceUri` (for tools that render as widgets)

## Build sequence

1. Create `HummblPublicMcpAgent` with read-only tools only
2. Deploy to `mcp-public.hummbl.io`
3. Add Apps SDK metadata (outputSchema, _meta.ui)
4. Build widget components
5. Test in developer mode
6. Submit for public distribution

## Public submission prerequisites

- [ ] Public read-only MCP stable
- [ ] Privacy policy URL published
- [ ] Terms of service URL published
- [ ] Rate limits active
- [ ] Abuse logging
- [ ] App name, logo, description
- [ ] Screenshots
- [ ] Test prompts and responses
- [ ] OAuth tested (if applicable)
- [ ] No write tools exposed
- [ ] Business verification

## References

- [Apps SDK Quickstart](https://developers.openai.com/apps-sdk/quickstart)
- [Build your MCP server](https://developers.openai.com/apps-sdk/build/mcp-server)
- [MCP Apps compatibility in ChatGPT](https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt)
- [UX principles](https://developers.openai.com/apps-sdk/concepts/ux-principles)
- [App submission guidelines](https://developers.openai.com/apps-sdk/app-submission-guidelines)
