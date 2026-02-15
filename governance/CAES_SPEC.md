# CAES Spec (v1.0.0)

CAES = **Coordination and Execution Standard** for HUMMBL repos.

This spec defines the minimum interoperability rules for:
- Human operators
- Cloud models (Codex/Claude/etc.)
- Local models (Ollama)
- Deterministic scripts (cron/launchd/CI)

## 1) Non-Negotiables

- **UTC timestamps only** in durable logs and bus entries.
- **Append-only coordination**: do not edit or delete historical entries from the bus.
- **Receipts-first**: if it cannot be supported by a command output, file path, or log line, it is not "done."
- **Draft-only local inference**: local model output is advisory; terminal + CI are authoritative.

## 2) Coordination Bus

The coordination bus is a TSV file:

`founder_mode/_state/coordination/messages.tsv`

### Required columns (tab-separated)

1. `timestamp_utc` (ISO-8601, e.g. `2026-02-08T22:00:00Z`)
2. `from`
3. `to`
4. `type` (see below)
5. `message` (single line; avoid secrets)

### Recommended message types

- `PROPOSAL`: intent before execution
- `ACK`: acknowledgement of a directive
- `STATUS`: progress update
- `SITREP`: end-of-thread summary with receipts
- `BLOCKED`: cannot proceed; include the blocker and evidence
- `DECISION`: operator decision recorded
- `QUESTION`: request for clarification

### Tooling

- Preferred writer: `tools/scripts/post_coordination_message.py`
- Integrity monitor: `tools/scripts/monitor_coordination_bus.py` (agent: `claire`)

## 3) Governance Guardrails

- **Network / destructive ops** must be explicitly authorized by the operator.
- If a repo ruleset requires **non-author approvals** but a shared identity blocks review, use **admin bypass** only when explicitly authorized and log it to the bus (`SITREP`).
- Never paste secrets into the bus. If a receipt includes secrets, store it privately and post only the path and a redacted summary.

## 4) Local Models (Ollama)

- Local models are **OFFLINE ONLY** and **draft-only**.
- All local-model runs should:
  - emit `PROPOSAL` before execution
  - store output under `founder_mode/state/local_models/`
  - emit `STATUS` with the output path and `SITREP` on completion

## 5) Versioning and Canonical Distribution

This repo is the canonical CAES source for HUMMBL.

Downstream repos that adopt CAES SHOULD include:
- `governance/CAES_SPEC.md`
- `governance/CAES_VERSION`
- `governance/CAES_CANONICAL.sha256` (sha256 pinned to canonical)

Automation for distribution/verification lives in `tools/caes/`.

## 6) Fork Exclusion Policy

When running CAES compliance verification across the hummbl-dev organization, the following exclusions apply:

### External Project Forks

Repositories that are forks of external (non-hummbl-dev) projects are **excluded from CAES compliance checks**. These repos:
- Originate from upstream projects outside hummbl-dev control
- May have their own governance standards
- Should not be modified to include CAES artifacts without upstream coordination

**Rationale**: CAES compliance is a hummbl-dev internal standard. Imposing it on external project forks would:
1. Create merge conflicts when syncing with upstream
2. Violate the principle of least surprise for external contributors
3. Diverge our forks unnecessarily from canonical upstreams

**Identification**: Forks are identified by checking if the repo's origin URL points to an external organization (non-hummbl-dev).

**Examples of excluded forks**:
- `openclaw-fork` (fork of external openclaw project)
- `OpenAgent`, `claude-code-infrastructure-showcase`, `clawdbot`, `clawdhub`, `everything-claude-code`, `workflow` (external community forks)

### Duplicate Clones

When multiple working copies of the same repository exist under the scan root (e.g., different paths but same origin URL), only the first encountered clone is verified. Subsequent duplicates are skipped to avoid redundant checks.

**Rationale**: Multiple clones of the same repo will have identical CAES artifacts (same origin, same commits). Verifying duplicates wastes time and inflates compliance statistics.

**Identification**: Duplicate clones are detected by comparing origin URLs during the scan.

### Deploy-Sensitive Repositories

Certain repos may be marked as deploy-sensitive and require special handling:
- `hummbl-production` - production deployment configurations

These repos are **not excluded** but compliance operations should be read-only (no automatic spec distribution without explicit authorization).
