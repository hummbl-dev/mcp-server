# AGENTS.md — mcp-server

## Project
**mcp-server** — HUMMBL MCP Server: a Model Context Protocol server exposing the Base120 mental models framework (120 validated models across 6 transformations: P, IN, CO, DE, RE, SY). TypeScript, published to npm as `@hummbl/mcp-server` (v1.2.0). Apache-2.0.

## Scope
- In scope: the MCP server (`src/`), HTTP server and Cloudflare Workers API (`src/http-server.ts`, `src/api.ts`), tool implementations (`get_model`, `list_all_models`, `search_models`, `recommend_models`, `get_transformation`, `search_problem_patterns`, `export_models`, `get_methodology`, `audit_model_references`), and the Base120 model dataset
- Out of scope: the Base120 framework specification itself (tracked in other HUMMBL repos), client-side Claude Desktop configuration

## Setup
Requires Node.js (check `.npmrc`/engines). Uses Vitest for tests, ESLint + Prettier for linting/formatting, Husky for git hooks.

```bash
git clone https://github.com/hummbl-dev/mcp-server.git
cd mcp-server
npm install
npm run build          # tsc
```

Dev:
```bash
npm run dev            # tsx src/index.ts (stdio MCP)
npm run dev:http       # tsx src/http-server.ts
npm run dev:api        # wrangler dev (Cloudflare Workers)
```

## Testing
```bash
npm test               # vitest run
npm run test:watch     # vitest (watch mode)
npm run test:coverage  # vitest run --coverage
npm run test:ui        # vitest --ui
```

Full pre-flight:
```bash
npm run validate       # typecheck + lint + test
```

Lint/format:
```bash
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm run typecheck      # tsc --noEmit
```

## Conventions
- TypeScript (ES modules, `target es2022`); strict type checking via `tsc --noEmit`
- ESLint + Prettier enforced; Husky pre-commit hooks
- npm package: `@hummbl/mcp-server`; also mirrored to GitHub Packages as `@hummbl-dev/mcp-server`
- Deploy via Wrangler to Cloudflare Workers (`npm run deploy`, `npm run deploy:staging`)
- Commit format: Conventional Commits
- Branch naming: type/agent/short-desc

## CI
GitHub Actions: `ci.yml` (build, typecheck, lint, test on every push/PR), `release.yml` (npm publish), `dependabot-auto-merge.yml` (dependency updates). Badge linked in README.
