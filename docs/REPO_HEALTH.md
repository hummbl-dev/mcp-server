# Repository Health Contract

## Ownership

- **Repository**: `hummbl-dev/mcp-server`
- **Canonical URL**: `https://github.com/hummbl-dev/mcp-server`
- **Owner**: HUMMBL Team
- **Stewardship scope**: TypeScript MCP server and API surfaces for serving HUMMBL Base120 models to AI agents.

## Lifecycle

- **Status**: Active public repository.
- **Default branch**: `main`.
- **Release posture**: Runtime, package, and API changes should land through pull requests with Node validation evidence. Tagged releases publish to npm and GitHub Packages.
- **Archive trigger**: Archive only if this MCP/API surface is superseded by another declared HUMMBL runtime package and package consumers are migrated.

## Source Of Truth

- `src/` is the source of truth for MCP server and API implementation.
- `package.json` is the source of truth for package scripts, package metadata, and supported Node engine.
- `README.md` is the source of truth for public installation and tool usage.
- `.github/workflows/ci.yml` is the primary validation workflow for pull requests.
- `.github/workflows/release.yml` is the source of truth for npm and GitHub Packages publishing.

## Validation Contract

Run from the repository root unless noted.

```bash
npm ci --legacy-peer-deps
npm run typecheck
npm run test:coverage
npm run format:check
npm run build
```

For focused local validation:

```bash
npm run validate
npm audit --audit-level=high
node scripts/validate-base120-refs.cjs
```

Expected CI coverage:

- `.github/workflows/ci.yml` runs type checking and coverage tests on Node.js 20.x and 22.x.
- `.github/workflows/ci.yml` runs the `Lint` job with `npm run lint:fix`, `npm run format:check`, and Base120 reference lint, plus npm audit, build, and build artifact checks.
- `.github/workflows/dependabot-auto-merge.yml` auto-merges eligible Dependabot patch/minor updates.
- `.github/workflows/release.yml` publishes tagged releases to npm and GitHub Packages.

## Branch Protection Expectation

`main` should be treated as protected:

- All non-trivial changes should land through pull requests.
- Required checks should include the Node matrix, the `Lint` job, and build jobs before merge. If branch protection separates lint from formatting or Base120 reference lint later, update this contract with the exact required check names.
- Package publishing changes should include release workflow review.
- Direct pushes to `main` should be limited to emergency operator action.

## Known Operational Gaps

- GitHub branch protection is tracked centrally in `hummbl-dev/hummbl-dev#18`; do not overclaim required checks until that audit is updated.
- The security-audit job currently runs `npm audit --audit-level=high` with `continue-on-error: true`; security posture changes should make any intentional non-blocking behavior explicit in PR bodies.

## Fleet Scan Classification

Future fleet scans can classify this repository as:

- **Lifecycle**: active
- **Visibility**: public
- **Primary function**: MCP/API runtime for Base120 model access
- **Validation entrypoint**: `npm run validate`
- **Primary metadata owner**: HUMMBL Team
