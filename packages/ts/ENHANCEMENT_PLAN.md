# HUMMBL MCP Server Enhancement Plan
*Implementation plan for 4 key enhancements*
*Created: 2026-01-21*

## Overview

This document outlines the implementation strategy for enhancing the HUMMBL MCP Server based on the NEW architecture (with storage and observability layers).

---

## Suggestion 1: Add Detailed Usage Examples to README

**Goal**: Provide real-world examples for each of the 6 tools to help users understand practical applications.

### Implementation Steps

1. **Update README.md** - Add "Usage Examples" section after "Available Tools"
2. **Create examples for each tool:**
   - `get_model` - Example with P1 (First Principles)
   - `list_all_models` - Example filtering by transformation
   - `search_models` - Example searching for "decision" related models
   - `recommend_models` - Example with a complex business problem
   - `get_transformation` - Example exploring the IN (Inversion) transformation
   - `search_problem_patterns` - Example searching for "innovation" patterns

### Files to Modify
- `README.md` (add new section after line 121)

### Example Format
```markdown
## Usage Examples

### Example 1: Getting a Specific Model
```json
// Request
{
  "tool": "get_model",
  "arguments": {
    "code": "P1"
  }
}

// Response
{
  "model": {
    "code": "P1",
    "name": "First Principles Framing",
    "definition": "Reduce complex problems to foundational truths...",
    "priority": 1,
    "transformation": "P"
  }
}
```

**When to use**: Starting a new problem analysis by identifying core assumptions.
```

### Time Estimate
- Writing examples: 1-2 hours
- Testing each example: 30 minutes
- Total: ~2.5 hours

### Success Criteria
- [ ] All 6 tools have working examples
- [ ] Examples show realistic use cases
- [ ] Response formats are accurate
- [ ] "When to use" guidance included

---

## Suggestion 2: Document PROBLEM_PATTERNS

**Goal**: Make pre-defined problem patterns discoverable and understandable.

### Current State
- `PROBLEM_PATTERNS` exists in `src/framework/base120.ts` but not documented
- Users can search via `search_problem_patterns` tool but don't know what's available

### Implementation Steps

1. **Extract patterns to documentation**
   - Create `docs/problem-patterns.md`
   - Document each pattern with:
     - Pattern description
     - Recommended transformations
     - Top models for this pattern
     - Example scenarios

2. **Update README**
   - Add "Problem Patterns" section linking to docs
   - Show how patterns map to transformations

3. **Add pattern enumeration tool** (optional enhancement)
   - New tool: `list_all_problem_patterns`
   - Returns complete catalog with metadata

### Files to Create/Modify
- `docs/problem-patterns.md` (new file)
- `README.md` (add section after Usage Examples)
- `src/tools/models.ts` (optional: add new tool)

### Documentation Structure
```markdown
# HUMMBL Problem Patterns

## Overview
Pre-defined patterns that map common problem types to recommended mental models.

## Pattern Catalog

### Pattern: Innovation Stagnation
**Description**: Organization stuck in incremental improvements, missing breakthrough opportunities

**Recommended Transformations**:
- IN (Inversion) - What if we stopped doing our core activity?
- CO (Composition) - How can we combine unlike elements?
- P (Perspective) - View from competitor/customer/future lens

**Top Models**:
- IN2: Inversion Thinking
- CO5: Cross-Pollination
- P4: Lens Shifting

**Example Scenarios**:
- Mature product line needs revitalization
- Market disruption threatening business model
- Team producing predictable but uninspired work
```

### Success Criteria
- [ ] All patterns from base120.ts documented
- [ ] Each pattern has real example scenarios
- [ ] Clear guidance on when to apply each pattern
- [ ] README links to pattern documentation

---

## Suggestion 3: Add Guided Workflow Tool

**Goal**: Create a tool that walks users through applying multiple models to a complex problem.

### Architecture Design

This leverages the NEW storage layer for multi-turn workflows.

```typescript
// New tool: apply_guided_workflow
{
  "tool": "apply_guided_workflow",
  "arguments": {
    "problem_description": "Our product launch failed despite positive testing",
    "workflow_type": "root_cause_analysis"  // or "strategy_design", "decision_making"
  }
}
```

### Implementation Steps

1. **Define workflow templates** in `src/framework/workflows.ts`
   ```typescript
   export interface WorkflowStep {
     stepNumber: number;
     transformation: TransformationType;
     models: string[];  // Model codes to apply
     prompt: string;    // Guidance for this step
     expectedOutput: string;  // What should result from this step
   }

   export interface WorkflowTemplate {
     name: string;
     description: string;
     problemTypes: string[];
     steps: WorkflowStep[];
   }
   ```

2. **Create initial workflow templates**
   - Root Cause Analysis (P → IN → DE)
   - Strategy Design (P → CO → SY)
   - Decision Making (P → IN → RE)

3. **Add workflow execution tool** in `src/tools/workflows.ts`
   - Registers new MCP tool: `apply_guided_workflow`
   - Uses SessionManager to track workflow state
   - Returns step-by-step guidance

4. **Track workflow progress** using storage layer
   - Store current step in session.domainState
   - Allow resuming interrupted workflows
   - Log workflow completion for analytics

### Files to Create/Modify
- `src/framework/workflows.ts` (new file)
- `src/tools/workflows.ts` (new file)
- `src/server.ts` (register new tool)
- `src/types/domain.ts` (add workflow types)

### Workflow Example
```typescript
// Step 1 response
{
  "workflow": "root_cause_analysis",
  "currentStep": 1,
  "totalSteps": 4,
  "transformation": "P",
  "guidance": "First, frame the problem from multiple perspectives...",
  "suggestedModels": ["P1", "P2", "P4"],
  "questions": [
    "What are the foundational assumptions about product-market fit?",
    "Who are all the stakeholders affected by this failure?",
    "What lens are we NOT looking through?"
  ],
  "nextAction": "Apply these models and share insights"
}
```

### Success Criteria
- [ ] At least 3 workflow templates implemented
- [ ] Workflow state persists in sessions
- [ ] Clear step-by-step guidance provided
- [ ] Users can resume interrupted workflows
- [ ] Metrics track workflow completion rates

---

## Suggestion 4: Add Opt-in Telemetry

**Goal**: Understand which models are most valuable to users to inform future development.

### Privacy & Ethics First
- **Opt-in only** - users must explicitly enable
- **Anonymized data** - no PII collected
- **Transparent** - clear documentation of what's tracked
- **User benefit** - show users their own usage patterns

### Architecture Design

Leverage existing observability infrastructure (metrics.ts).

### Implementation Steps

1. **Add telemetry configuration**
   ```typescript
   // src/observability/telemetry.ts (new file)
   export interface TelemetryConfig {
     enabled: boolean;
     userId?: string;  // Optional identifier (could be hash)
     endpoint?: string;  // Where to send data
   }

   export interface TelemetryEvent {
     eventType: 'model_accessed' | 'tool_called' | 'workflow_completed';
     timestamp: string;
     modelCode?: string;
     toolName?: string;
     workflowName?: string;
     sessionId: string;
   }
   ```

2. **Track key metrics**
   - Model access frequency (which models get queried)
   - Search query patterns (what problems users describe)
   - Workflow completion rates
   - Tool usage distribution

3. **Add telemetry tool** for users to view their data
   ```typescript
   // New tool: get_my_usage_stats
   {
     "tool": "get_my_usage_stats",
     "arguments": {
       "time_period": "last_30_days"
     }
   }
   ```

4. **Enable/disable via environment**
   ```bash
   HUMMBL_TELEMETRY_ENABLED=true
   HUMMBL_TELEMETRY_ENDPOINT=https://telemetry.hummbl.io
   ```

5. **Update README with telemetry disclosure**

### Files to Create/Modify
- `src/observability/telemetry.ts` (new file)
- `src/tools/telemetry.ts` (new file)
- `src/server.ts` (initialize telemetry if enabled)
- `README.md` (add Privacy & Telemetry section)
- `.env.example` (add telemetry config)

### Data Structure
```typescript
// Aggregated telemetry (what gets sent)
{
  "period": "2026-01-21T00:00:00Z",
  "sessionCount": 45,
  "modelAccess": {
    "P1": 120,  // First Principles most accessed
    "IN2": 87,  // Inversion second
    "CO3": 56
  },
  "topSearches": [
    { "query": "decision making", "count": 23 },
    { "query": "innovation", "count": 18 }
  ],
  "workflowCompletions": {
    "root_cause_analysis": 12,
    "strategy_design": 8
  }
}
```

### User Benefits
- See which models they use most
- Discover underutilized models that might help
- Track their learning progress through the framework
- Compare usage patterns (anonymously) with community

### Success Criteria
- [ ] Telemetry is opt-in with clear documentation
- [ ] No PII collected
- [ ] Users can view their own usage stats
- [ ] Aggregated data informs framework improvements
- [ ] Clear privacy policy in README

---

## Implementation Priority

### Phase 1 (Immediate - 1-2 days)
1. ✅ Suggestion 1: Usage Examples (high impact, low effort)
2. ✅ Suggestion 2: Document Problem Patterns (high value, medium effort)

### Phase 2 (Near-term - 1 week)
3. ✅ Suggestion 3: Guided Workflows (high impact, requires storage layer testing)

### Phase 3 (Future - 2 weeks)
4. ✅ Suggestion 4: Opt-in Telemetry (valuable but requires careful implementation)

---

## Dependencies

### Existing Infrastructure (Already Built ✅)
- Storage layer (SessionManager, HistoryManager)
- Observability (Logger, Metrics, Tracing)
- Type safety (Zod schemas, TypeScript strict)

### New Dependencies Needed
- None! All suggestions build on existing infrastructure

---

## Testing Strategy

### For Each Suggestion
1. Unit tests for new functions
2. Integration tests with MCP protocol
3. End-to-end tests in Claude Desktop
4. Documentation validation

### Test Files to Create
- `src/__tests__/workflows.test.ts` (Suggestion 3)
- `src/__tests__/telemetry.test.ts` (Suggestion 4)

---

## Rollout Strategy

1. **Branch strategy**
   - `feature/usage-examples` (Suggestion 1)
   - `feature/problem-patterns-docs` (Suggestion 2)
   - `feature/guided-workflows` (Suggestion 3)
   - `feature/telemetry` (Suggestion 4)

2. **Version bumps**
   - Suggestions 1-2: Patch version (1.0.0-beta.3)
   - Suggestion 3: Minor version (1.1.0-beta.1)
   - Suggestion 4: Minor version (1.2.0-beta.1)

3. **User communication**
   - Update CHANGELOG.md for each suggestion
   - Add migration guides if needed
   - Announce new features in README

---

## Success Metrics

### Quantitative
- [ ] README examples lead to 50% reduction in support questions
- [ ] Problem patterns documentation accessed by 80% of users
- [ ] Guided workflows show 70% completion rate
- [ ] Telemetry opt-in rate above 30%

### Qualitative
- [ ] User feedback indicates easier onboarding
- [ ] Developers can create new workflows without assistance
- [ ] Users report discovering relevant models they didn't know existed
- [ ] Privacy approach builds trust

---

## Next Steps

1. Review this plan with stakeholders
2. Create GitHub issues for each suggestion
3. Set up feature branches
4. Begin Phase 1 implementation (Examples + Patterns)
5. Iterate based on early user feedback

---

*This plan leverages the NEW architecture with storage and observability. The foundational work is done—these enhancements build on that solid base.*
