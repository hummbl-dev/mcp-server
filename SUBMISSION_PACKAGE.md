# HUMMBL MCP Server - Anthropic Directory Submission Package

## Submission Information

**Extension Name**: HUMMBL Base120 Mental Models  
**Extension Type**: Desktop Extension (MCPB - Model Context Protocol Bundle)  
**Version**: 1.2.0  
**Repository**: https://github.com/hummbl-dev/mcp-server  
**Homepage**: https://hummbl.io  
**Privacy Policy**: https://hummbl.io/privacy  
**License**: Apache-2.0

## Description

HUMMBL Base120 is a comprehensive cognitive framework consisting of 120 validated mental models organized across 6 transformations: Perspective (P), Inversion (IN), Composition (CO), Decomposition (DE), Recursion (RE), and Meta-Systems (SY). This MCP server enables Claude to select appropriate mental models for any problem, apply transformation types to reframe challenges, and provide comprehensive analysis using multiple cognitive frameworks.

**Key Features:**
- Access to 120 validated mental models across 6 cognitive transformations
- AI-powered model recommendations based on natural language problem descriptions
- Guided multi-turn workflows for systematic problem-solving (root cause analysis, strategy design, decision making)
- Self-Dialectical AI Systems methodology with HUMMBL Base120 mappings
- Export capabilities (Markdown, JSON, PDF) for building briefing docs and slide decks
- URI-based resource access for direct model and transformation queries

## Tool Inventory (13 tools)

### Model Lookup Tools
1. **get_model** - Retrieve detailed information about a specific HUMMBL mental model using its code (e.g., P1, IN3, CO5)
2. **list_all_models** - Retrieve complete list of all 120 HUMMBL mental models with optional transformation filter
3. **search_models** - Search HUMMBL mental models by keyword across codes, names, and definitions
4. **get_transformation** - Retrieve information about a specific transformation type and all its models (P, IN, CO, DE, RE, SY)

### Analysis Tools
5. **search_problem_patterns** - Find pre-defined problem patterns with recommended transformations and top models based on a search query
6. **recommend_models** - Get recommended mental models based on a natural language problem description using HUMMBL REST API (requires HUMMBL_API_KEY)

### Methodology Tools
7. **get_methodology** - Retrieve the canonical Self-Dialectical AI Systems methodology with HUMMBL Base120 mappings
8. **audit_model_references** - Audit a list of HUMMBL model references for existence, transformation alignment, and duplicates

### Workflow Tools
9. **list_workflows** - Get all available guided workflows for problem-solving with Base120 mental models
10. **start_workflow** - Begin a guided multi-turn workflow for systematic problem-solving using Base120 mental models
11. **continue_workflow** - Proceed to the next step of your guided workflow after completing the current step
12. **find_workflow_for_problem** - Discover which workflow best fits your problem type or situation

### Export Tools
13. **export_models** - Export a curated subset of Base120 mental models as Markdown, JSON, or PDF

## Resource Inventory (5 resources)

1. **model-by-code** (`hummbl://model/{code}`) - Access individual mental model by code (e.g., hummbl://model/P1)
2. **transformation-models** (`hummbl://transformation/{type}`) - Access all models in a transformation (e.g., hummbl://transformation/P)
3. **all-models** (`hummbl://models`) - Complete Base120 framework with all 120 mental models
4. **self-dialectical-methodology** (`hummbl://methodology/self-dialectical-ai`) - Canonical Self-Dialectical AI Systems methodology with HUMMBL Base120 mappings (JSON)
5. **self-dialectical-methodology-markdown** (`hummbl://methodology/self-dialectical-ai/overview`) - Human-readable markdown overview of the Self-Dialectical AI Systems methodology

## Prompt Inventory (6 prompts)

### Workflow Prompts
1. **root_cause_analysis** - Guided workflow for systematic root cause analysis using Base120 mental models
2. **strategy_design** - Guided workflow for strategy design and planning using Base120 mental models
3. **decision_making** - Guided workflow for structured decision making using Base120 mental models

### General Prompts
4. **analyze_with_models** - Open-ended analysis: surface the most relevant Base120 mental models for a problem and synthesise them into concrete guidance
5. **apply_model** - Apply one specific HUMMBL mental model (by code, e.g. P1, IN3, CO5) to a problem

## Technical Specifications

### Runtime Requirements
- **Platform**: Node.js (TypeScript)
- **Node Version**: >=20.0.0
- **OS Support**: macOS, Windows, Linux
- **Transport**: stdio (for Claude Desktop integration)

### Dependencies
- @modelcontextprotocol/sdk
- zod
- jspdf (for PDF export)

### Environment Variables (Optional)
- `HUMMBL_API_KEY` - Required for the `recommend_models` tool only (uses HUMMBL REST API for AI-powered recommendations). All other tools work without this key.

### Data Flow
- **Local data**: All 120 mental models, transformations, and methodology definitions are embedded in the server binary
- **API calls**: Only the `recommend_models` tool makes external API calls to the HUMMBL REST API (when API key is configured)
- **No telemetry**: The server does not collect or transmit usage data

## Privacy and Data Handling

### Data Collection
- The server does not collect or transmit any user data
- All mental model data is embedded locally in the server binary
- The optional `recommend_models` tool sends problem descriptions to the HUMMBL REST API for model recommendations (only when API key is configured)

### Data Storage
- No persistent storage of user data
- No logging of tool invocations or prompts
- Session state is ephemeral (workflow state can be persisted via optional session_id parameter)

### Third-Party Sharing
- No data is shared with third parties except as described above for the optional `recommend_models` tool
- HUMMBL API usage is governed by the HUMMBL Terms of Service

### Data Retention
- No data retention policies apply (no data is stored)

### Contact
- Privacy inquiries: reuben@hummbl.io
- GitHub issues: https://github.com/hummbl-dev/mcp-server/issues

## Installation Instructions

### Claude Desktop Configuration

Add the following to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "hummbl": {
      "command": "node",
      "args": ["C:/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

### Build from Source

```bash
git clone https://github.com/hummbl-dev/mcp-server.git
cd mcp-server
npm install
npm run build
```

The built server will be in `dist/index.js`.

## Testing Instructions

### Manual Testing in Claude Desktop

1. Install the server following the installation instructions above
2. Restart Claude Desktop
3. Try these example prompts:

**Test model lookup:**
```
Get me the definition of mental model P1.
```

**Test search:**
```
Search for mental models related to "systems thinking".
```

**Test workflow:**
```
I need to analyze why our product launch failed. Use the root cause analysis workflow.
```

**Test recommendations:**
```
Recommend mental models for this problem: "We're struggling with team communication across time zones."
```

**Test export:**
```
Export all models from the Perspective transformation as Markdown.
```

### Automated Testing

```bash
npm test
```

## Screenshots Needed

The following screenshots should be provided for the submission:

1. **Claude Desktop Integration** - Show the server configured in Claude Desktop settings
2. **Tool Invocation** - Show Claude using a tool (e.g., `get_model` or `recommend_models`)
3. **Workflow Execution** - Show a multi-turn workflow in progress
4. **Resource Access** - Show accessing a resource via URI (e.g., `hummbl://model/P1`)
5. **Prompt Selection** - Show selecting a prompt from the Claude Desktop prompt menu

## Branding Assets

### Icon
- 256x256 PNG icon for Claude Desktop extension
- Should represent mental models, cognitive frameworks, or structured reasoning

### Screenshots
- 1280x720 PNG screenshots showing the extension in use
- Should demonstrate key features (model lookup, workflows, recommendations)

## Checklist for Submission

- [x] manifest.json created with required fields
- [x] Privacy policy documented (https://hummbl.io/privacy)
- [x] Tool inventory documented (13 tools)
- [x] Resource inventory documented (5 resources)
- [x] Prompt inventory documented (6 prompts)
- [x] Technical specifications documented
- [x] Installation instructions provided
- [x] Testing instructions provided
- [ ] Screenshots provided (operator action)
- [ ] Branding assets provided (operator action)
- [ ] Test account credentials provided (if needed for review)
- [ ] Submission form filled out (operator action)

## Operator Action Items

1. **Fill out submission form** at https://clau.de/desktop-extention-submission
2. **Provide screenshots** of the extension in use
3. **Provide branding assets** (icon, screenshots)
4. **Provide test account credentials** if needed for review (HUMMBL API key for testing `recommend_models` tool)
5. **Confirm policy checklists** in the submission form

## Notes for Reviewers

- The `recommend_models` tool requires an API key to function. For testing purposes, a test API key can be provided upon request.
- All other tools work without any external dependencies or API keys.
- The server is designed to be safe for offline use (except for the optional recommendation feature).
- The framework is well-documented with comprehensive examples and use cases.
- The codebase follows TypeScript best practices with full type safety and Zod schema validation.
