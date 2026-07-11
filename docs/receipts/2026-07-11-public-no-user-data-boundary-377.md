# Receipt: Public No-User-Data Boundary (#377)

## Target
- Repository: `hummbl-dev/mcp-server`
- Issue: #377
- Branch: `feat/devin/public-no-user-data-boundary-377`

## Scope
- Documented public/private responsibility boundary
- Created threat model for accidental user-data exposure
- Classified tool/resource inventory by user-data risk
- Implemented CI guard tests (8 tests, all passing)

## Changed files
- `docs/architecture/public-private-boundary.md` — architecture note
- `docs/architecture/public-boundary-threat-model.md` — STRIDE threat model
- `src/__tests__/public-boundary.test.ts` — 8 boundary tests

## Validation results
- `npx vitest run src/__tests__/public-boundary.test.ts` — 8/8 passed

## Tests implemented
1. Public model tools have no prohibited user-data input fields
2. Public methodology tools have no prohibited user-data input fields
3. No public tool name matches prohibited user-data patterns
4. No public tool has a write or mutation semantic as primary verb
5. No public resource URI matches prohibited user-data patterns
6. Error message fixtures do not echo raw sensitive payloads (fixture-based)
7. Candidate model publication posture (fixture-based principle check)
8. Private-world-model tools not registered on public agent

## Not yet covered by executable tests
- Log redaction enforcement (no runtime log capture test)
- Output schema scanning for user-model fragments (schemas are static)
- Candidate model publication posture (delegated to `admission.test.ts`)
- Complete public tool set registration separation (delegated to `public-tool-profile.test.ts`)

## Existing coverage (pre-existing)
- `src/__tests__/public-tool-profile.test.ts` — 12 tests for tool registration separation
- `src/__tests__/admission.test.ts` — admission posture tests

## Residual risks
- Future private runtime must maintain separate authentication
- De-identification policy is separately reviewed
- No claim that current public surface handles all future user-data scenarios

## Review requirement
- Yes — architectural boundary change requires non-author review

## Cross-references
- Parent: `hummbl-dev/hummbl-dev#149`
- Voice/runtime: `hummbl-dev/hummbl-dev#124`
- This issue: `hummbl-dev/mcp-server#377`
