# Repository Health Contract

## Identity

- **Repository**: `HUMMBL/mcp-server`
- **Canonical host**: `https://anvil.tail0ff7b3.ts.net/HUMMBL/mcp-server` (private Gitea lane for governance coordination)
- **Public mirror**: `https://github.com/hummbl-dev/mcp-server`
- **Default branch**: `main`
- **Visibility**: Public
- **Owner**: HUMMBL Team

## Lifecycle

- **Status**: Active
- **Visibility posture**: public mirror + private Gitea coordination lane
- **Purpose**: Deliver MCP-compatible governance-aware APIs and associated cloud/edge infrastructure tooling.

## Canonical Relationship

- **Source of truth (primary)**: `hummbl-dev/mcp-server` (public GitHub mirror).
- **Gitea lane role**: secondary coordination and execution lane for local governance workflows.

## Validation Contract

From repository root:

```bash
npm install
npm run validate
```

For focused verification during routine contribution:

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
```

## Branch Protection Expectation

- `main` should be PR-first and review-driven.
- For non-doc changes, merge should require the validation stack above or equivalent
  project-specific checks.
- Gitea/GitHub PR path should keep direct push disabled by default.
- Branch protection should require at least one review for non-trivial changes.
