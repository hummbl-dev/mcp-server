# B2 Schema Survey — POST /v1/relationships

**Date**: 2026-06-23
**Auditor**: devin (GLM-5.2, T2-COGNITION)
**Purpose**: Evidence pack for operator decision on finding B2 (two conflicting POST /v1/relationships schemas)
**Method**: Read-only survey of DB schema, D1 client, type definitions, HTTP handlers, OpenAPI doc, and test suite

## Summary

The codebase is **mid-migration** from `source_code`/`target_code` (legacy) → `model_a`/`model_b` (canonical). The DB schema, D1 client, and tests all use `model_a`/`model_b`. The live HTTP handler (`api.ts:156`) is the lagging surface still speaking the legacy dialect. The dead handler (`routes/relationships.ts:147`) had the right schema but was never swapped in.

## Evidence

### DB layer (`src/storage/d1-client.ts`)

**Canonical table** (`relationships`, lines 168-185):
- Columns: `model_a`, `model_b`, `direction`, `logical_derivation`, `confidence` (A/B/C/U), `review_status`, `literature_*`
- Foreign keys: `model_a` → `mental_models(code)`, `model_b` → `mental_models(code)`
- Indexes: `idx_relationships_model_a`, `idx_relationships_model_b`

**Legacy table** (`model_relationships`, lines 208-220):
- Columns: `source_code`, `target_code`, `relationship_type`, `confidence` (A/B/C only), `evidence`
- Comment: "Legacy model_relationships table (kept for migration)"
- Foreign keys: `source_code` → `mental_models(code)`, `target_code` → `mental_models(code)`

**Migration function** (`migrateLegacyRelationships`, lines 241-289):
- Copies legacy rows from `model_relationships` into `relationships`
- Maps `source_code` → `model_a`, `target_code` → `model_b`, `evidence` → `logical_derivation`
- Sets `direction = 'a→b'`, `review_status = 'draft'`, `validated_by = 'legacy-import'`

### D1 client methods

**`createRelationship(input: RelationshipRecordInput)`** — LIVE, called by api.ts:184
- Accepts BOTH naming conventions: `input.model_a ?? input.source_code` (line 422-423)
- Type `RelationshipRecordInput` explicitly supports both (lines 211-214):
  ```typescript
  model_a?: string;
  model_b?: string;
  source_code?: string;
  target_code?: string;
  ```
- Called from: api.ts:184 (live handler)

**`createCanonicalRelationship(input)`** — DEAD, called only by routes/relationships.ts:205
- Accepts only `model_a`/`model_b` (line 504)
- Called from: routes/relationships.ts:205 (dead handler)
- **This method is dead code** — only caller is the shadowed handler per finding B1

### HTTP layer

**Live handler** (`src/api.ts` lines 156-190):
- Accepts: `source_code`, `target_code`, `relationship_type`, `confidence`, `evidence`
- Validates: `confidence` must be A, B, or C (line 172) — rejects "U"
- Does NOT accept: `direction`, `logical_derivation`, `literature_support`, `validated_by`, `review_status`
- Calls: `db.createRelationship(relationshipInput)` with `source_code`/`target_code` naming

**Dead handler** (`src/routes/relationships.ts` lines 147-215):
- Accepts: `model_a`, `model_b`, `relationship_type`, `direction`, `logical_derivation`, `confidence`, `literature_support`, `empirical_observation`, `validated_by`, `notes`
- Validates: `confidence` allows A, B, C, U (via `isConfidence()` type guard)
- Calls: `db.createCanonicalRelationship(relationshipData)`

### OpenAPI doc (`src/openapi.ts` lines 77-90)

```typescript
const createRelationshipRequestSchema: JsonSchema = {
  type: "object",
  properties: {
    source_code: { type: "string", example: "P1" },
    target_code: { type: "string", example: "IN3" },
    relationship_type: { ... },
    confidence: { type: "string", enum: ["A", "B", "C"] },
    evidence: { type: "string" },
  },
  required: ["source_code", "target_code", "relationship_type", "confidence"],
};
```

Matches the live api.ts handler. **Narrower than what `createRelationship` accepts** — documents only the legacy naming, not the canonical one.

### Test suite

**`src/__tests__/d1-client.test.ts`** (lines 65-151):
- Exercises `createRelationship` with **`model_a`/`model_b`** + `literature_support` (canonical naming)
- Does NOT use `source_code`/`target_code` anywhere
- Tests: creates relationship + maps literature support, throws DuplicateRelationshipError on unique constraint, rejects update with no valid fields

**`src/__tests__/api-middleware.test.ts`** (lines 188-256):
- Tests DELETE /v1/relationships/:id (uses `model_a`/`model_b` rows in mock data)
- **No POST /v1/relationships test exists** — the live POST handler has zero HTTP-level test coverage

**No test anywhere in the repo uses `source_code`/`target_code`.**

### Scripts

- `scripts/import-relationships-csv.ts` — referenced in package.json (`import-relationships` script) but **file does not exist** in the repo
- No other script calls POST /v1/relationships or uses `source_code`/`target_code`

## Surface-by-surface summary

| Surface | Naming used | Status |
|---|---|---|
| DB schema (`relationships` table) | `model_a`/`model_b` | Canonical |
| DB schema (`model_relationships` table) | `source_code`/`target_code` | Legacy, kept for migration |
| D1 client `createRelationship` | Both (normalizes via `??`) | Live, dual-mode |
| D1 client `createCanonicalRelationship` | `model_a`/`model_b` only | Dead |
| Test suite (`d1-client.test.ts`) | `model_a`/`model_b` | Canonical |
| Test suite (`api-middleware.test.ts`) | `model_a`/`model_b` (mock data only) | Canonical |
| HTTP handler (api.ts:156, live) | `source_code`/`target_code` | **Lagging** |
| HTTP handler (routes/relationships.ts:147, dead) | `model_a`/`model_b` | Shadowed |
| OpenAPI doc | `source_code`/`target_code` | Matches live handler, narrower than impl |

## Migration direction

**Unambiguous: `model_a`/`model_b` is canonical.** Evidence:
1. The canonical `relationships` table uses `model_a`/`model_b`
2. The legacy `model_relationships` table uses `source_code`/`target_code` and has a migration function to copy into `relationships`
3. The D1 client `createRelationship` accepts both but normalizes to `model_a`/`model_b`
4. The test suite exercises `model_a`/`model_b` exclusively
5. The dead `createCanonicalRelationship` method uses `model_a`/`model_b` only

The live HTTP handler (`api.ts:156`) is the **only surface still speaking the legacy dialect** at the HTTP boundary.

## Recommended fix (third option)

Neither "keep api.ts as-is" nor "revive routes/relationships.ts" is correct. The right fix completes the migration at the HTTP boundary:

1. **Update api.ts:156** to accept `model_a`/`model_b` as primary, with `source_code`/`target_code` as a **deprecated alias** (for backward compat with any existing API consumers). Accept the richer fields (`direction`, `logical_derivation`, `literature_support`, `validated_by`, `review_status`). Allow `confidence: "U"`.
2. **Update OpenAPI** to document `model_a`/`model_b` as primary, `source_code`/`target_code` as deprecated, and the richer fields.
3. **Delete the dead handlers** in `routes/relationships.ts` (POST/PATCH/DELETE/GET /relationships, GET /models/:code/relationships) — they're shadowed duplicates, not the canonical path.
4. **Delete `db.createCanonicalRelationship`** — dead, and `createRelationship` already handles canonical naming.
5. **Add a POST test** to `api-middleware.test.ts` — the live POST handler currently has zero HTTP-level test coverage.
6. **Keep `GET /v1/graph`** in routes/relationships.ts (it's the only unique, reachable route there).

This completes the migration at the HTTP boundary without breaking existing consumers (the deprecated alias preserves backward compat).

## Operator decision

**Pending.** Operator reviewing this evidence pack before approving the third option.
