# KRINEIA.md — mcp-server

**krineia_manifest_version:** 0.1
**schema:** krineia-manifest@0.1

This is the repo-local KRINEIA manifest for `hummbl-dev/mcp-server`. It declares how this repo participates in KRINEIA governance.

---
krineia_manifest_version: "0.1"
schema: "krineia-manifest@0.1"

repo:
  full_name: "hummbl-dev/mcp-server"
  default_branch: "main"
  visibility: "public"

authority:
  steward: "HUMMBL Research Institute"
  approving_human: "Reuben Bowlby"
  source_of_record: "git"
  receipt_authority: "external_observer"

governance_profile:
  status: "adopted"
  krineia_required: true
  trust_root_mode: "deployment_asserted"
  receipt_chain_required_for:
    - "canonical_docs"
    - "schema_changes"
    - "validator_changes"
    - "agent_handoffs"
    - "authority_changes"
    - "release_tags"

chains:
  primary:
    chain_id: "mcp-server-primary"
    storage: "_receipts/krineia/primary.jsonl"
    genesis_policy: "repo_bootstrap"
    hash_algorithm: "sha256"
    canonicalization: "json.dumps(sort_keys=True,separators=(',',':'))"

operators:
  allowed:
    - "append"
    - "project"
    - "cut"
  forbidden:
    - "update"
    - "delete"
    - "rewrite"
    - "summarize_and_replace"
    - "score_and_train"

boundaries:
  no_reward_path_self_reference: true
  external_analysis_only: true
  observed_agent_may_write_receipts: false
  receipts_may_train_agents: false

verification:
  validator: "external"
  required_before_merge: false
  required_before_release: true

related_docs:
  readme: "README.md"
  agents: "AGENTS.md"
  constitution: "CONSTITUTION.md"

last_reviewed: "2026-06-22"
---

## Notes

### Chain bootstrapping

The primary chain at `_receipts/krineia/primary.jsonl` is bootstrapped with a genesis receipt recording the adoption of this manifest. The genesis receipt has `prev_hash` = 64 ASCII zeros per the KRINEIA receipt schema.

### Trust-root mode

v0.1 uses `deployment_asserted` trust-root mode: a separate observer process writes the chain, and the observed agent has no write path. This satisfies Invariant 5 by process boundary.

### Receipt-triggering changes

Per `CONSTITUTION.md` §6, receipt-triggering changes are listed in that document. Non-triggering changes (routine dependency bumps, docs, test additions that do not alter protected invariants) do not require a receipt.

### Verification

Receipt structure and hash linkage are validated externally. A chain can pass hash validation and still fail KRINEIA if the surrounding system violates any of the five invariants.
