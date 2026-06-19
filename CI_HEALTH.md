# CI Health — hummbl-dev/mcp-server

Last updated: 2026-06-19

## Known Issues

### 1. Stale Local Checkout (Resolved)
- **Issue:** #235 — orphan checkout from 2026-05-13 devops scan
- **Status:** Closed. Orphan archived, diff captured to `/tmp/mcp-server-orphan-2026-05-02.patch`

### 2. Missing Test Coverage
- **Issue:** #233 — zero tests for MCP handlers, tool registration, gate-check protocol, auth middleware
- **Status:** Open, acknowledged. Scheduled for next sprint.
- **Target:** 40% coverage on `src/`

### 3. CI Failure on PR Branch
- **Run:** 2026-06-18T10:57:01Z — `docs/codex/chatgpt-apps-marketplace-proposal`
- **Status:** Failed (likely transient or branch-specific)

## Recently Fixed
- Issue #235 closed — orphan checkout reconciled

## CI Workflows
| Workflow | Status | Notes |
|----------|--------|-------|
| `CI` | Partial failure | One recent PR run failed |
| `Dependabot Auto-merge` | Skipped | Not running on some PRs |
| `pages build and deployment` | Success | Main branch healthy |

Generated with [Devin](https://devin.ai)
