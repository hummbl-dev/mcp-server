# Package Publication Receipt — @hummbl/mcp-server

**Package:** `@hummbl/mcp-server`  
**Version:** 1.2.0  
**Receipt Date:** 2026-07-03  
**Verified By:** Copilot (automated registry check)  
**Status:** VERIFIED (npm ✅ · GitHub Packages ⚠️ pending v1.2.0 mirror)

---

## Acceptance Checklist

- [x] npm route is verified and documented
- [x] GitHub Packages status is verified and documented
- [x] Install command is current and copy/paste-safe
- [x] Public package evidence is linked from the receipt

---

## 1. npm Route

| Field | Value |
|-------|-------|
| **Package** | `@hummbl/mcp-server` |
| **Latest version** | 1.2.0 |
| **Published** | 2026-04-19T12:43:45Z |
| **Registry URL** | https://www.npmjs.com/package/@hummbl/mcp-server |
| **Tarball** | https://registry.npmjs.org/@hummbl/mcp-server/-/mcp-server-1.2.0.tgz |
| **Tarball shasum** | `952283e568397fddcb86d93a084ee11bf98246f7` |
| **Integrity** | `sha512-oBfnhWt6pbIcYbSWW8P8Qy4tu71q4RHmxxncLZTib02v6iOvBQxX1n+APmPjNO1wttPakETrUttBlD4fiMxz/A==` |
| **License** | Apache-2.0 |
| **Node requirement** | >=20.0.0 |
| **Status** | ✅ PUBLISHED — live on the public npm registry |

### Version History (npm)

| Version | Published |
|---------|-----------|
| **1.2.0** (latest) | 2026-04-19 |
| 1.0.3 | 2026-02-05 |
| 1.0.2 | 2025-12-06 |
| 1.0.1 | 2025-12-06 |
| 1.0.0 | 2025-12-06 |

### Install Commands — npm (copy/paste safe)

```bash
# Global installation (recommended for Claude Desktop)
npm install -g @hummbl/mcp-server

# Run without installing (npx)
npx @hummbl/mcp-server
```

---

## 2. GitHub Packages Route

| Field | Value |
|-------|-------|
| **Package** | `@hummbl-dev/mcp-server` |
| **Registry** | `https://npm.pkg.github.com` |
| **GitHub Packages page** | https://github.com/hummbl-dev/mcp-server/pkgs/npm/mcp-server |
| **Workflow** | `.github/workflows/release.yml` (dual-publish step present) |
| **Status** | ⚠️ PENDING — dual-publish workflow is in place but has not been triggered for v1.2.0 |

### Status detail

The `release.yml` workflow contains a dual-publish step that rewrites the package name from `@hummbl/mcp-server` to `@hummbl-dev/mcp-server` before publishing to `npm.pkg.github.com`. This step was added after the v1.0.3 release (the last tagged release, published 2026-02-05). The v1.2.0 npm publication was performed outside the tagged release workflow (no `v1.2.0` tag exists in the repository), so the GitHub Packages mirror does not yet carry v1.2.0.

The dual-publish will activate automatically when a `v*` tag is pushed through the standard release workflow.

### Install Commands — GitHub Packages (copy/paste safe)

> GitHub Packages requires a GitHub personal access token (PAT) with `read:packages` scope, even for public packages. Create a token at https://github.com/settings/tokens.

**Step 1 — Add to your project's `.npmrc`:**

```
@hummbl-dev:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
```

**Step 2 — Install:**

```bash
npm install @hummbl-dev/mcp-server
```

---

## 3. Public Package Evidence

| Route | Link | Verified Status |
|-------|------|-----------------|
| npm package page | https://www.npmjs.com/package/@hummbl/mcp-server | ✅ Live (v1.2.0) |
| npm tarball | https://registry.npmjs.org/@hummbl/mcp-server/-/mcp-server-1.2.0.tgz | ✅ Live |
| GitHub Packages page | https://github.com/hummbl-dev/mcp-server/pkgs/npm/mcp-server | ⚠️ Pending v1.2.0 |
| GitHub Release | https://github.com/hummbl-dev/mcp-server/releases/tag/v1.0.3 | ✅ v1.0.3 |
| Release workflow run | https://github.com/hummbl-dev/mcp-server/actions/runs/21720564663 | ✅ Last success (v1.0.3) |
| Release workflow file | `.github/workflows/release.yml` | ✅ Dual-publish steps present |
| Glama.ai badge | https://glama.ai/mcp/servers/@hummbl-dev/mcp-server | ✅ Indexed |

---

## 4. Recommended Install (Current)

For production and Claude Desktop use, install from npm (the authoritative public registry):

```bash
npm install -g @hummbl/mcp-server
```

### Claude Desktop Configuration

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "hummbl": {
      "command": "npx",
      "args": ["-y", "@hummbl/mcp-server"]
    }
  }
}
```

---

## 5. Notes

- **Primary registry**: `@hummbl/mcp-server` on npmjs.org is the authoritative install route and is fully public — no authentication required.
- **GitHub Packages mirror**: `@hummbl-dev/mcp-server` on `npm.pkg.github.com` requires GitHub authentication and will carry v1.2.0 once the next tagged release is published through `release.yml`.
- **CI/Release workflow**: The `.github/workflows/release.yml` workflow publishes to both registries when a `v*` tag is pushed. See workflow file for implementation detail.
- **Parent coordination issue**: https://github.com/hummbl-dev/hummbl-production/issues/557
