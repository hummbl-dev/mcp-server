# CONSTITUTION.md — mcp-server

**Status:** v0.1
**Steward:** HUMMBL Research Institute
**Approving human:** Reuben Bowlby
**Standard:** HUMMBL Repo Standard v0.1
**Source of record:** git

## 1. Identity

`hummbl-dev/mcp-server` — Model Context Protocol server exposing the HUMMBL Base120 mental-models framework (120 validated models across 6 transformations), plus an HTTP server and Cloudflare Workers API surface. Published to npm as @hummbl/mcp-server.

- **Class:** library
- **Visibility:** public
- **License:** Apache-2.0
- **Validation:** `npm run validate`

## 2. Scope

This constitution operates under the HUMMBL Repo Standard (`hummbl-dev/hummbl-governance/docs/standards/HUMMBL_REPO_STANDARD.md`) and the operating-environment constitution on the host machine. This constitution may be stricter than both, never weaker.

## 3. Protected invariants

These invariants are constitutionally protected. They cannot be changed, weakened, or conditionally suspended without a constitutional amendment (§7), a KRINEIA receipt, and human approval.

1. **Base120 canonical integrity.** The set of 120 model codes and transformation assignments is canonical. audit_model_references must validate codes against this canon.
2. **MCP tool contract.** The nine named tools are a public contract. Tool names, argument shapes, and response envelopes are additive-only; breaking changes require a major-version bump.
3. **TypeScript strictness.** tsc --noEmit must pass. Type safety is not relaxed to land a change.
4. **Validation gate.** npm run validate (typecheck + lint + test) is the authoritative pre-flight.
5. **Conventional Commits.** Enforced via Husky commit-msg. Branch naming: type/agent/short-desc.
6. **License boundary.** Apache-2.0 retained on all source. No proprietary license introduced.
7. **Receipt chain continuity.** _receipts/krineia/primary.jsonl is append-only. Existing entries not rewritten except by recorded cut.

## 4. Normative files

The following files are normative. Edits require steward review (see `CODEOWNERS`):

- `CONSTITUTION.md`
- `KRINEIA.md`
- `hummbl.repo.yaml`
- `CODEOWNERS`
- `data/models.json`
- `data/all-models.json`
- `src/tools/`
- `AGENTS.md`

## 5. Authority

- **Steward:** HUMMBL Research Institute
- **Approving human:** Reuben Bowlby
- **Codeowners:** `CODEOWNERS`
- **Agent operating contract:** `AGENTS.md`
- **Receipt manifest:** `KRINEIA.md`

## 6. Receipt-triggering changes

The following changes require a KRINEIA receipt before admission:

- Any change to the public MCP tool contract (tool names, argument or response shapes)
- Any change to the Base120 canon in data/models.json or data/all-models.json
- Any change to the validation gate (npm run validate), CI workflows, or Husky hooks
- Any change to governance artifacts (CONSTITUTION.md, KRINEIA.md, hummbl.repo.yaml, CODEOWNERS)
- Any change to package identity, license, or publish target
- Any cut on the Krineia receipt chain

## 7. Amendment

Changes to this constitution require: a PR, an ADR under `docs/adr/`, a KRINEIA receipt, and human approval (Reuben Bowlby). Breaking changes bump this constitution's version (SemVer) and trigger a fleet re-audit of all repos consuming this repo's outputs.
