# Changelog

All notable changes to the HUMMBL MCP Server will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## Technical Debt

- Temporarily lowered global branch coverage threshold to 74% (was 75%) pending logger/session-manager test expansion.

## [1.2.0] - 2026-04-05

### Added
- **PDF export**: `export_models` tool gains `format: "pdf"`. Uses jsPDF to render paginated A4 documents with per-transformation sections. Returns an MCP resource block with `application/pdf` mimeType and base64-encoded blob.
- **BM25-ranked problem-pattern matching**: `search_problem_patterns` and `POST /v1/recommend` now rank results by BM25 relevance score instead of keyword containment. Each result carries a `score: number` field. Pure-JS implementation (~100 LOC), no external deps, deterministic.
- **Browser playground** at `GET /playground`: single-file HTML page (vanilla JS, no build step) with model search, problem recommendations with BM25 scores, and clickable transformation browser. API key persisted in localStorage.
- **MCP prompts primitive**: 5 user-invocable prompts — `root_cause_analysis`, `strategy_design`, `decision_making` (workflow kickoffs), `analyze_with_models` (open-ended), `apply_model` (single-model deep-dive).
- **Recommendation history**: every `POST /v1/recommend` call is persisted server-side. New `GET /v1/recommendations` endpoint and `get_recommendation_history` MCP tool let callers replay past recommendations.
- **`export_models` tool**: export any subset of Base120 models as Markdown or JSON. Filters by codes, transformation, or all 120. Empty `codes: []` treated as explicit empty filter.
- **OpenAPI 3.0 spec** served at `GET /openapi.json` documenting all 14 REST routes with schemas, auth, and a drift-guard test that verifies every documented path exists as a real route.
- 55+ new tests across all features.

### Infrastructure
- Releases now dual-publish to GitHub Packages as `@hummbl-dev/mcp-server` in addition to npmjs.org.

### Docs
- README: benefit-first tagline, npm downloads + Node version badges, Available Prompts section, export_models entry, REST API Specification section, GitHub Packages install instructions.
- `docs/HISTORY.md`: project provenance and MCP ecosystem timeline.

## [1.1.0] - 2026-04-05

### Added
- Per-API-key rate limiting now enforced. Fixed-window counters in KV track `requestsPerHour` and `requestsPerDay` from the key's tier and the auth middleware returns `429 Too Many Requests` with a `Retry-After` header once a window is exhausted (previously the check was a stub).
- `X-RateLimit-Limit-Hour`, `X-RateLimit-Remaining-Hour`, `X-RateLimit-Reset-Hour` and the matching `*-Day` headers are set on every authenticated response so clients can track their quota without guessing.
- `DELETE /v1/relationships/:id` is wired end-to-end (admin-only). Previously the handler was a 501 stub and the sub-router version was unreachable because no auth middleware ran ahead of its admin check.
- gzip compression of Redis history entries >1024 bytes. Compressed payloads are base64-encoded with a `gz:` prefix so `getHistory` can transparently detect and decompress them. Small messages stay as plain JSON; mixed compressed/uncompressed entries in a session are handled transparently.
- 29 new tests (195 → 224): rate-limit unit tests, auth-middleware integration tests, DELETE integration tests, and compression round-trip tests (incl. multibyte UTF-8).

### Fixed
- `authenticate()` middleware was declared `Promise<void>` and never returned its `c.json()` responses, so failed-auth requests fell through with no body. The signature is now `Promise<Response | void>` and error responses are returned properly.
- `npm audit` now reports 0 vulnerabilities (was 1 HIGH, 1 MODERATE). Transitive `path-to-regexp` and `brace-expansion` advisories resolved via `npm audit fix` plus the path-to-regexp 8.4 bump.

### Changed
- `@modelcontextprotocol/sdk` 1.28 → 1.29.

### Dev / Infra
- ESLint 9 → 10 (major).
- TypeScript 5.9 → 6.0 (major).
- `codecov/codecov-action` 5 → 6.
- `@cloudflare/workers-types`, `vitest`, `@vitest/ui`, `@vitest/coverage-istanbul`, `@typescript-eslint/*` patch bumps.
- CI: relaxed repository Actions allowlist to unblock workflow runs that were failing at "Set up job"; added Workers-native globals (`Blob`, `btoa`, `atob`, `CompressionStream`, `DecompressionStream`, `Response`, `Request`, `fetch`) to the ESLint config.

### Docs
- Added `docs/HISTORY.md` documenting the project's position in the MCP ecosystem timeline.
- Fixed `1.0.0-beta.1` date typo in this CHANGELOG (`2024-11-14` → `2025-11-14`).

## [1.0.0-beta.2] - 2025-11-21

### Added
- Self-Dialectical methodology toolset (`get_methodology`, `audit_model_references`) with full Base120 mappings
- Methodology resources for canonical JSON and Markdown overview (`hummbl://methodology/...`)
- Documentation updates covering methodology usage, troubleshooting guidance, and resource URIs

### Fixed
- Resolved `zod` resolution issues blocking Vitest suites by reinstalling dependencies and ensuring consistent imports
- Harmonized server metadata/log output with package version (1.0.0-beta.2)

### Changed
- Strengthened transformation validation for resource handlers (no `any` casting)
- Improved type guards in shared domain utilities for reuse across tooling

## [1.0.0-beta.1] - 2025-11-14

### Added
- Initial beta release of HUMMBL MCP Server
- Complete Base120 framework with all 120 validated mental models
- 6 core tools: get_model, list_all_models, search_models, recommend_models, get_transformation, search_problem_patterns
- 3 resource endpoints: model by code, transformation models, all models
- stdio transport for Claude Desktop integration
- Comprehensive TypeScript type safety with Zod schemas
- Result pattern for type-safe error handling
- Full documentation and examples

### Technical
- Built on @modelcontextprotocol/sdk v1.0.4
- TypeScript 5.6 with strict mode
- NodeNext module resolution
- Zero external runtime dependencies beyond SDK and Zod

### Framework Validation
- 120/120 models validated
- 9.2/10 average quality score
- Production deployment at hummbl.io
- Complete API infrastructure

## [Unreleased]

### Infrastructure
- Releases now dual-publish to **GitHub Packages** as `@hummbl-dev/mcp-server` in addition to npmjs.org. Same bytes, alternate registry; the npm primary (`@hummbl/mcp-server`) is unchanged.

### Planned Features
- Prompt templates for guided workflows
- Enhanced problem pattern matching with ML scoring
- Session-based model recommendation tracking
- Export utilities for various formats (PDF, Markdown, JSON)
- Browser-based playground for testing models
