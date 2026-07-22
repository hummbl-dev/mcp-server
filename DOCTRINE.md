# DOCTRINE.md - mcp-server

**Status:** v0.1
**Steward:** HUMMBL Research Institute

## 1. Thesis

Claude (and any MCP-compatible client) should have structured access to HUMMBL's 120 validated mental models. mcp-server is the bet that exposing Base120's six cognitive transformations — Perspective, Inversion, Composition, Decomposition, Recursion, Synthesis — through the Model Context Protocol gives agents sharper analysis and systematic problem-solving as a first-class tool, not a prompt trick.

The server is the bridge between HUMMBL's cognitive framework and the agent runtimes that consume it. It is published to npm, CI-gated, and designed to be installed with one command.

## 2. Conceptual vocabulary

- **MCP** — Model Context Protocol; the standard interface for tool exposure to AI clients.
- **Base120** — 120 mental models across 6 transformations (P/IN/CO/DE/RE/SY x 20).
- **Transformation** — a cognitive move family (Perspective, Inversion, Composition, Decomposition, Recursion, Synthesis).
- **Mental model** — a single validated reasoning operator within a transformation family.
- **Tool exposure** — the MCP surface that makes Base120 queryable and applicable by agents.

## 3. Design principles

1. One MCP server, one framework — Base120 is the entire cognitive surface exposed.
2. Published to npm (`@hummbl/mcp-server`) for one-command installation.
3. CI-gated — lint, test, and build on every push.
4. The server is a bridge, not a source of truth — Base120's canonical registry lives elsewhere.
5. Node/TypeScript implementation for MCP ecosystem compatibility.

## 4. Boundaries

mcp-server is NOT the canonical Base120 registry, NOT a governance runtime, and NOT an agent orchestrator. It is the MCP exposure layer that makes the framework available to clients.

## 5. Open questions

- Should the server expose governance primitives (receipts, contracts) alongside mental models?
- How does the server stay in sync with Base120 registry updates without breaking installed clients?
- What is the right versioning strategy — server version vs. framework version?
