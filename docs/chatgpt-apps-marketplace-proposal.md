# PROPOSAL: ChatGPT Apps Marketplace for HUMMBL MCP Servers

Status: Proposed
Date: 2026-06-18
Owner: Reuben Bowlby
Primary repo: `hummbl-dev/mcp-server`
Primary package: `@hummbl/mcp-server`

## 1. Decision Requested

Approve a bounded productization lane to turn HUMMBL MCP servers into ChatGPT Apps, starting with a public, read-only Base120 app and keeping internal HUMMBL governance, bus, BaseN, secrets, and mutating operations out of the first marketplace surface.

The recommended first app is:

```text
HUMMBL Base120 Problem Solver
```

It should expose a narrow set of read-only tools for mental model lookup, search, workflow recommendation, and structured problem solving. It should not expose internal operating-system controls or proprietary generation workflows.

## 2. Context

OpenAI's Apps SDK documentation describes ChatGPT apps as MCP-backed applications with tool metadata, optional iframe UI resources, authentication and security posture, developer-mode testing, and dashboard submission review.

The current HUMMBL MCP server already has useful foundations:

- TypeScript MCP server package: `@hummbl/mcp-server`.
- MCP SDK dependency and stdio entry point.
- HTTP/SSE entry point for remote server experimentation.
- Zod-backed tool schemas.
- `structuredContent` responses on many tools.
- `readOnlyHint` annotations on core tools.
- Base120 model lookup, search, workflow, methodology, and export tools.

The current server is not yet marketplace-ready:

- Remote transport currently uses HTTP/SSE; Streamable HTTP is the preferred target for remote app deployment.
- Apps SDK-specific resource metadata and UI widget wiring are not present.
- Auth is a local GitHub OAuth scaffold with in-memory state/session storage.
- README privacy language still describes a local-only Claude Desktop server while the repo also contains remote HTTP/API paths.
- Public product boundary is not yet separated from internal HUMMBL governance and proprietary BaseN/IP surfaces.

## 3. Goals

- Create a public ChatGPT App submission path for HUMMBL's MCP portfolio.
- Start with the lowest-risk public value: Base120 lookup and guided problem-solving.
- Preserve internal/private boundaries for BaseN, Domain120 drafts, governance receipts, bus controls, and operator-only actions.
- Establish a reusable app adapter pattern for future HUMMBL MCP servers.
- Produce reviewable artifacts: source changes, tests, privacy disclosures, app metadata, evaluation prompts, and submission checklist.

## 4. Non-Goals

- Do not expose the whole HUMMBL operating system as a public app.
- Do not publish BaseN generation, candidate lattice promotion, scoring rubrics, corpora, or proprietary workflows.
- Do not expose mutating governance, bus, repo, cloud, secret, deployment, billing, or operator-control tools.
- Do not claim medical, legal, financial, psychedelic, or compliance authority beyond evidence.
- Do not submit to OpenAI review until local Developer Mode testing and privacy/security review pass.

## 5. Option Set

### Option A: Tool-Only Public Base120 App

Create a minimal ChatGPT app from the current MCP server with a curated read-only tool set and no custom UI.

Pros:

- Fastest path to Developer Mode testing.
- Lowest product and security complexity.
- Keeps value focused on model/tool quality.

Cons:

- Less differentiated user experience.
- Harder to present Base120 relationships visually.

Use when:

- The priority is validating marketplace mechanics quickly.

### Option B: Public Base120 App With Lightweight UI

Create a ChatGPT app with read-only tools plus a small embedded UI for model cards, workflow steps, and comparison tables.

Pros:

- Better marketplace quality.
- Clearer differentiation.
- Fits Apps SDK's tool plus widget architecture.

Cons:

- Requires component bundle, CSP/resource metadata, UI testing, and accessibility checks.

Use when:

- The priority is a polished first public submission.

### Option C: Private Workspace HUMMBL Operating App

Create an internal/private ChatGPT connector for State-of-the-State, receipts, repo state, and governance context.

Pros:

- High operational value.
- Can integrate internal evidence surfaces.

Cons:

- Not suitable as a first public marketplace app.
- Higher secret, auth, and permission risk.

Use when:

- The operator wants internal ChatGPT-native HUMMBL OS access after public boundaries are proven.

### Option D: Enterprise Governance App

Package selected governance and receipt primitives as an enterprise app for customer-owned repos/artifacts.

Pros:

- Strong enterprise positioning.
- Monetizable as compliance/assurance infrastructure.

Cons:

- Requires stronger claim discipline, audit logs, tenant isolation, and legal review.

Use when:

- Base120 app pattern is validated and HUMMBL wants paid enterprise distribution.

### Option E: One Gateway App For Many MCP Servers

Build one HUMMBL app gateway that routes to multiple internal MCP servers.

Pros:

- Centralized auth, observability, and app metadata.
- Easier portfolio management once mature.

Cons:

- More complex tool discovery.
- Higher blast radius.
- Easy to blur public/private boundaries.

Use when:

- Multiple narrow apps have already been hardened and a gateway can enforce policy centrally.

## 6. Recommendation

Adopt Option B in two steps:

1. Build Option A first as the minimal Developer Mode proof.
2. Add a small UI component before public submission if Developer Mode results are clean.

The first app should include only read-only tools:

- `base120_get_model`
- `base120_search_models`
- `base120_list_transformation`
- `base120_recommend_models`
- `base120_list_workflows`
- `base120_start_workflow`
- `base120_continue_workflow`

Tool names should be app-scoped and action-oriented. If existing names are retained internally, the ChatGPT app adapter should expose marketplace-facing aliases without breaking existing Claude/local clients.

## 7. Proposed Architecture

```text
current MCP core
  -> app adapter layer
  -> curated public tool registry
  -> optional UI resource registry
  -> Streamable HTTP transport
  -> public HTTPS deployment
  -> Developer Mode testing
  -> OpenAI dashboard submission
```

Recommended repo shape:

```text
src/
  server.ts
  apps/
    chatgpt/
      app-server.ts
      public-tools.ts
      resources.ts
      metadata.ts
      auth.ts
      README.md
web/
  chatgpt/
    base120-widget.html
docs/
  chatgpt-apps-marketplace-proposal.md
  chatgpt-app-submission-checklist.md
  chatgpt-app-privacy-review.md
evals/
  chatgpt-base120-readonly.xml
```

The adapter should import core Base120 data/tool logic rather than duplicating framework content.

## 8. Security And Privacy Requirements

Before public submission:

- Replace broad CORS with a production allowlist.
- Prefer Streamable HTTP for remote app deployment.
- Decide no-auth vs OAuth for v1. If no user persistence is needed, prefer no-auth read-only.
- If OAuth is required, use a production identity provider and persistent encrypted session storage.
- Remove or avoid returning internal request IDs, trace IDs, tokens, logs, auth data, and unnecessary user metadata.
- Publish accurate privacy policy and terms.
- Document data retention, data sharing, and deletion controls.
- Add prompt-injection and hostile-input tests for all tool inputs.
- Ensure all public tools are read-only and annotated accordingly.

## 9. IP Boundary Requirements

Public app may expose:

- Base120 canonical public mental model descriptions.
- Public examples and problem-solving guidance.
- Ratified public methodology descriptions.

Public app must not expose by default:

- BaseN generator internals.
- Domain120 drafts or unratified domain lattices.
- Promotion workflows, scoring rubrics, corpora, and validation pipelines.
- Internal governance receipts, bus messages, repo state, operator state, or fleet controls.
- Secrets, cloud configuration, or production operational state.

Use `Domain120` naming for domain ratified sets when they later become public. Do not blur Base120, Domain120, and BaseN.

## 10. Implementation Phases

### Phase 0: Readiness Audit

Deliverables:

- Current tool inventory.
- Public/private tool classification.
- Data-flow map.
- Privacy mismatch report.
- Transport/auth gap report.

Exit criteria:

- Operator approves first public app boundary.

### Phase 1: Minimal Developer Mode App

Deliverables:

- ChatGPT app adapter with curated read-only tools.
- App metadata draft.
- Streamable HTTP or explicitly justified SSE compatibility path.
- Local and remote Developer Mode connection instructions.
- Basic evaluation file with at least 10 realistic read-only tasks.

Exit criteria:

- App can be connected in Developer Mode.
- Core tool calls produce structured, minimal outputs.
- No internal/private surfaces exposed.

### Phase 2: UI And Submission Package

Deliverables:

- Optional Base120 UI widget for model cards and workflow steps.
- CSP/resource metadata.
- Privacy policy update.
- Terms/disclosure draft.
- Submission checklist.
- Security review notes.

Exit criteria:

- App passes local build/test/lint.
- App passes Developer Mode smoke tests.
- Privacy/security review has no blocking findings.

### Phase 3: OpenAI Submission

Deliverables:

- Dashboard submission package.
- App listing metadata.
- Country/distribution decision.
- Support contact and maintenance owner.

Exit criteria:

- Operator explicitly approves submission.
- Identity/business verification status is confirmed.

### Phase 4: Portfolio Expansion

Candidate apps:

- HUMMBL Decision Coach.
- HUMMBL Root Cause Analysis.
- HUMMBL Strategy Design.
- HUMMBL Receipt Compiler, private or enterprise first.
- HUMMBL Governance Explorer, private or enterprise first.
- Domain120 Explorer, after naming and IP boundaries are ratified.

Exit criteria:

- First app is approved or feedback is incorporated into the adapter pattern.

## 11. Acceptance Criteria

First public app is ready for operator submission approval only when:

- Tool surface is read-only and app-scoped.
- Tool descriptions follow "Use this when..." style where appropriate.
- Input schemas are narrow and validated.
- Output schemas are explicit and minimal.
- `structuredContent` is present for model-consumable outputs.
- Read-only annotations are present and accurate.
- No internal/private HUMMBL surfaces are exposed.
- Privacy policy matches actual runtime data flow.
- Developer Mode connection works against a public HTTPS endpoint.
- At least 10 read-only evaluation tasks pass manually or via evaluator.
- Security/privacy review is complete.
- Operator approves submission.

## 12. Risks

- Marketplace review risk: app may be rejected if metadata, privacy, UX, or policy posture is weak.
- IP leakage risk: broad HUMMBL tools could expose proprietary BaseN or internal governance surfaces.
- Privacy mismatch risk: current README local-only language conflicts with remote app behavior.
- Auth risk: in-memory OAuth/session handling is not production-grade.
- Transport risk: SSE may work, but Streamable HTTP is the cleaner target for remote deployment.
- Scope risk: gatewaying too many servers too early can create a confused and unsafe app surface.
- Claim risk: "validated mental models" and related claims should be reviewed for evidence and public wording.

## 13. Operator Decisions Needed

- Public first app name: `HUMMBL Base120 Problem Solver`, `HUMMBL Mental Models`, or another name.
- First app boundary: Base120-only, Base120 plus workflows, or broader.
- Auth posture: no-auth read-only, OAuth, or workspace-only.
- UI posture: tool-only Developer Mode first, or UI from the start.
- Public IP posture: what exact Base120 content is approved for broad public distribution.
- Submission posture: public marketplace, workspace-only, or private Developer Mode until further notice.

## 14. Sources

- OpenAI Apps SDK: https://developers.openai.com/apps-sdk
- Build your MCP server: https://developers.openai.com/apps-sdk/build/mcp-server
- MCP concept: https://developers.openai.com/apps-sdk/concepts/mcp-server
- Define tools: https://developers.openai.com/apps-sdk/plan/tools
- Connect from ChatGPT: https://developers.openai.com/apps-sdk/deploy/connect-chatgpt
- Submit and maintain your app: https://developers.openai.com/apps-sdk/deploy/submission
- App submission guidelines: https://developers.openai.com/apps-sdk/app-submission-guidelines
