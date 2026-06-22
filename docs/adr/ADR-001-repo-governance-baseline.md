# ADR-001 — mcp-server repo governance baseline

- **Status:** accepted
- **Date:** 2026-06-22
- **Decision owner:** Reuben Bowlby
- **Steward:** HUMMBL Research Institute
- **Supersedes:** none
- **Superseded by:** none

## Context

A live audit of all 91 `hummbl-dev` repositories found that `hummbl-dev/mcp-server` had a strong `AGENTS.md` but was missing the core governance artifact stack: `CONSTITUTION.md`, `KRINEIA.md`, `hummbl.repo.yaml`, `CODEOWNERS`, `_receipts/`, `docs/adr/`, `docs/handoffs/`.

The HUMMBL Repo Standard v0.1 was adopted in parallel (ADR-003 in `hummbl-governance`). This repo is part of the 7/15 cluster rollout — repos that scored 7/15 on the baseline audit and are closest to full compliance.

## Decision

Adopt the HUMMBL Repo Standard v0.1 artifact stack for `hummbl-dev/mcp-server`.

### Files added

| File | Purpose |
|------|---------|
| `CONSTITUTION.md` | binding repo law: identity, scope, protected invariants, authority, receipt-triggering changes, amendment |
| `KRINEIA.md` | repo-local receipt manifest: primary chain, trust-root mode, operators, verification |
| `hummbl.repo.yaml` | machine-readable registry atom per the standard's schema |
| `CODEOWNERS` | review authority per path; normative files require steward approval |
| `docs/adr/ADR-001-repo-governance-baseline.md` | this decision record |
| `_receipts/krineia/primary.jsonl` | genesis receipt bootstrapping the primary governance chain |
| `docs/handoffs/2026-06-22-repo-governance-baseline.md` | handoff note |

### Files unchanged

`AGENTS.md` — already repo-specific and provider-neutral. Reviewed against the standard; no edits required.

## Alternatives considered

- **Wait for full fleet rollout.** Rejected: this repo is in the 7/15 cluster and close to compliance. Adding the governance stack now establishes the precedent.
- **Use the .github templates verbatim.** Rejected: the standard explicitly forbids blind templating. These files are locally grounded in the actual repo content.

## Consequences

- **Positive:** 7 protected invariants are now constitutionally protected. Weakening them requires a constitutional amendment + receipt + human approval.
- **Positive:** Machine-readable manifest (`hummbl.repo.yaml`) enables fleet-wide audit automation.
- **Negative:** The genesis receipt is written by the agent that created this PR (devin). Acceptable for bootstrap; subsequent receipts must be written by an external observer per Invariant 5.

## Validation

- `hummbl.repo.yaml` validates against `hummbl-dev/hummbl-governance/schemas/hummbl-repo-manifest.schema.json`.
- `_receipts/krineia/primary.jsonl` passes hash chain validation.
- `AGENTS.md` requires no changes (already compliant).

## Receipts

- Genesis receipt: `_receipts/krineia/primary.jsonl` line 1. Records the adoption of this governance baseline.
