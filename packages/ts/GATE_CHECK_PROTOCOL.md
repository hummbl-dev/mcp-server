# Gate Check Protocol

**Purpose**: Systematic quality assurance between implementation phases
**Status**: ACTIVE - Use for all phase transitions
**Created**: 2026-01-21

---

## Overview

This protocol ensures each implementation phase meets quality standards before proceeding to the next. It prevents compounding technical debt, catches issues early, and maintains high quality throughout development.

### When to Run

- ✅ Before merging a feature branch
- ✅ Before proceeding to next phase of implementation plan
- ✅ Before releasing to production
- ✅ After major refactoring
- ✅ When directed by team lead

### How to Use

1. Work through each category sequentially
2. Check items that pass ✅
3. Document any failures with action items
4. Phase cannot proceed until all **REQUIRED** items pass
5. **OPTIONAL** items can be deferred with justification

---

## Gate Check Categories

### 1. Code Quality ⚙️

#### REQUIRED

- [ ] **No TypeScript errors**: `npm run typecheck` passes
- [ ] **Linting passes**: `npm run lint` shows zero errors
- [ ] **Formatting consistent**: `npm run format:check` passes
- [ ] **No console.log/debugger statements** in production code
- [ ] **Error handling**: All async operations have try-catch or .catch()
- [ ] **No hardcoded secrets**: API keys, passwords, tokens use env vars
- [ ] **Function complexity**: No function exceeds 50 lines (or justified)
- [ ] **Naming conventions**: Variables/functions clearly describe purpose
- [ ] **No commented-out code**: Removed or explained with TODO

#### OPTIONAL

- [ ] Code coverage above 80%
- [ ] Complexity metrics within thresholds (cyclomatic < 10)
- [ ] No duplication above 5% (DRY principle)

**Action Items** (if any failures):
```
[List what needs to be fixed before proceeding]
```

---

### 2. Testing 🧪

#### REQUIRED

- [ ] **All tests pass**: `npm test` succeeds
- [ ] **New features have tests**: Every new function/tool has at least one test
- [ ] **Critical paths tested**: Core functionality covered
- [ ] **No skipped tests**: No `.skip()` or `xit()` without justification
- [ ] **Tests are deterministic**: No flaky tests (run 3x to verify)

#### OPTIONAL

- [ ] Integration tests for new features
- [ ] Performance/load tests
- [ ] Edge case coverage
- [ ] Mutation testing

**Test Coverage Report**:
```bash
npm run test:coverage
# Paste summary here
```

**Action Items**:
```
[List missing tests or test failures]
```

---

### 3. Documentation 📚

#### REQUIRED

- [ ] **README updated**: New features documented
- [ ] **API documentation**: All public functions have JSDoc comments
- [ ] **Examples provided**: Real-world usage examples for new features
- [ ] **Breaking changes noted**: CHANGELOG.md updated if applicable
- [ ] **Links work**: All markdown links resolve correctly
- [ ] **Installation instructions**: Accurate and tested

#### OPTIONAL

- [ ] Video/GIF demonstrations
- [ ] Architecture diagrams updated
- [ ] Tutorial or guide created
- [ ] FAQ updated

**Documentation Checklist**:
- [ ] User can understand what the feature does
- [ ] User can implement the feature without asking questions
- [ ] Edge cases and limitations documented
- [ ] Migration path clear (if breaking change)

**Action Items**:
```
[List documentation gaps]
```

---

### 4. User Experience 🎯

#### REQUIRED

- [ ] **Error messages are helpful**: Users know what went wrong and how to fix it
- [ ] **Validation is clear**: Input requirements explained upfront
- [ ] **No silent failures**: Errors are surfaced, not swallowed
- [ ] **Response times acceptable**: < 3s for typical operations
- [ ] **Backwards compatible**: Existing users not broken (unless major version)

#### OPTIONAL

- [ ] Onboarding flow tested with new user
- [ ] Accessibility considerations
- [ ] Mobile/responsive (if applicable)
- [ ] Localization support

**User Testing Notes**:
```
[Test with actual user or document hypothetical user journey]
```

**Action Items**:
```
[List UX improvements needed]
```

---

### 5. Technical Debt 🏗️

#### REQUIRED

- [ ] **No TODO comments** without GitHub issues (or create issues)
- [ ] **Known bugs documented**: Issues created with reproduction steps
- [ ] **Dependencies up to date**: No critical security vulnerabilities
- [ ] **Deprecated APIs removed**: Or migration plan documented
- [ ] **Dead code removed**: Unused imports, functions, files deleted

#### OPTIONAL

- [ ] Refactoring opportunities documented
- [ ] Performance optimization opportunities noted
- [ ] Architecture improvements identified

**Technical Debt Inventory**:
```bash
# Check for TODOs
grep -r "TODO" src/ --exclude-dir=node_modules

# Check for FIXMEs
grep -r "FIXME" src/ --exclude-dir=node_modules

# Check dependencies
npm audit
```

**Action Items**:
```
[List technical debt that must be addressed vs. deferred]
```

---

### 6. Dependencies 📦

#### REQUIRED

- [ ] **No critical vulnerabilities**: `npm audit` shows no critical/high issues
- [ ] **License compatibility**: All dependencies have compatible licenses
- [ ] **Dependencies justified**: Each dependency has clear purpose
- [ ] **Lock file updated**: package-lock.json committed
- [ ] **Peer dependencies satisfied**: No unmet peer dependency warnings

#### OPTIONAL

- [ ] Dependencies updated to latest stable
- [ ] Bundle size acceptable
- [ ] Tree-shaking verified

**Dependency Audit**:
```bash
npm audit
npm ls --depth=0
```

**Action Items**:
```
[List dependency issues]
```

---

### 7. Performance ⚡

#### REQUIRED

- [ ] **No obvious bottlenecks**: Profiling shows acceptable performance
- [ ] **Memory leaks checked**: Long-running processes don't grow unbounded
- [ ] **Database queries optimized**: N+1 queries eliminated
- [ ] **Caching implemented**: Expensive operations cached where appropriate
- [ ] **Resource cleanup**: Connections, files, listeners properly closed

#### OPTIONAL

- [ ] Load testing completed
- [ ] CDN/asset optimization
- [ ] Lazy loading implemented
- [ ] Performance budgets met

**Performance Benchmarks**:
```
[Document key metrics: response time, memory usage, etc.]
```

**Action Items**:
```
[List performance improvements needed]
```

---

### 8. Security 🔒

#### REQUIRED

- [ ] **Input validation**: All user inputs validated and sanitized
- [ ] **SQL injection prevention**: Parameterized queries or ORM used
- [ ] **XSS prevention**: User content escaped
- [ ] **CSRF protection**: (if applicable)
- [ ] **Authentication/authorization**: Proper access controls
- [ ] **Secrets management**: No secrets in code or logs
- [ ] **Dependencies scanned**: No known vulnerabilities

#### OPTIONAL

- [ ] Security audit by third party
- [ ] Penetration testing
- [ ] Rate limiting implemented
- [ ] DDoS protection

**Security Checklist**:
```bash
npm audit
# Check for exposed secrets
git log -p | grep -i "password\|api_key\|secret"
```

**Action Items**:
```
[List security concerns]
```

---

### 9. Observability 📊

#### REQUIRED

- [ ] **Logging implemented**: Key operations logged with context
- [ ] **Errors logged**: All errors captured with stack traces
- [ ] **Log levels appropriate**: Debug/info/warn/error used correctly
- [ ] **No PII in logs**: Personal information excluded
- [ ] **Metrics instrumented**: Key operations have metrics (if observability exists)

#### OPTIONAL

- [ ] Distributed tracing
- [ ] Alerting configured
- [ ] Dashboard created
- [ ] SLO/SLA defined

**Observability Checklist**:
- [ ] Can debug production issues from logs
- [ ] Can measure performance in production
- [ ] Can detect and alert on failures

**Action Items**:
```
[List observability gaps]
```

---

### 10. Deployment Readiness 🚀

#### REQUIRED

- [ ] **Build succeeds**: `npm run build` completes without errors
- [ ] **Environment variables documented**: .env.example updated
- [ ] **Configuration validated**: Required env vars checked at startup
- [ ] **Deployment tested**: Deployed to staging/preview environment
- [ ] **Rollback plan exists**: Can revert if deployment fails
- [ ] **Migration path clear**: Database migrations tested (if applicable)

#### OPTIONAL

- [ ] Canary deployment strategy
- [ ] Blue-green deployment
- [ ] Feature flags
- [ ] A/B testing setup

**Deployment Checklist**:
```
[Document deployment steps and validation]
```

**Action Items**:
```
[List deployment blockers]
```

---

## Gate Decision Matrix

| Category | Status | Required | Blocker | Notes |
|----------|--------|----------|---------|-------|
| Code Quality | ⬜ | ✅ | ⬜ | |
| Testing | ⬜ | ✅ | ⬜ | |
| Documentation | ⬜ | ✅ | ⬜ | |
| User Experience | ⬜ | ✅ | ⬜ | |
| Technical Debt | ⬜ | ✅ | ⬜ | |
| Dependencies | ⬜ | ✅ | ⬜ | |
| Performance | ⬜ | ✅ | ⬜ | |
| Security | ⬜ | ✅ | ⬜ | |
| Observability | ⬜ | ⬜ | ⬜ | |
| Deployment | ⬜ | ✅ | ⬜ | |

**Legend**:
- ⬜ Status: Not Started / 🟡 In Progress / ✅ Complete / ❌ Failed
- Blocker: Issues that prevent proceeding to next phase

---

## Final Gate Decision

**Reviewers**: [Names]
**Date**: [YYYY-MM-DD]

### Summary

**Required Items**: __ / __ passing
**Blocker Count**: __

### Decision

- [ ] ✅ **PASS** - Proceed to next phase
- [ ] 🟡 **CONDITIONAL PASS** - Proceed with documented action items
- [ ] ❌ **FAIL** - Must address blockers before proceeding

### Deferred Items

If conditional pass, list items deferred to future phase with justification:

```
1. [Item] - Reason for deferral, assigned to [person], due [date]
2. [Item] - Reason for deferral, assigned to [person], due [date]
```

### Sign-off

**Technical Lead**: _____________ Date: _______
**Product Owner**: _____________ Date: _______
**QA Lead**: _____________ Date: _______

---

## Automation Scripts

### Quick Gate Check

```bash
#!/bin/bash
# gate-check.sh - Run automated checks

echo "🔍 Running Gate Check Protocol..."

echo "✓ TypeScript compilation..."
npm run typecheck || exit 1

echo "✓ Linting..."
npm run lint || exit 1

echo "✓ Formatting..."
npm run format:check || exit 1

echo "✓ Tests..."
npm test || exit 1

echo "✓ Build..."
npm run build || exit 1

echo "✓ Security audit..."
npm audit --audit-level=high || exit 1

echo "✅ All automated checks passed!"
echo "📋 Complete manual checklist in GATE_CHECK_PROTOCOL.md"
```

### Add to package.json

```json
{
  "scripts": {
    "gate-check": "bash gate-check.sh"
  }
}
```

---

## Phase-Specific Considerations

### Phase 1 (Documentation/Examples)
- **Focus**: Documentation quality, examples accuracy, user clarity
- **Critical**: All examples must be tested and work
- **Can defer**: Performance optimizations, advanced testing

### Phase 2 (New Features)
- **Focus**: Code quality, testing, backwards compatibility
- **Critical**: Tests pass, no breaking changes
- **Can defer**: Performance tuning, advanced observability

### Phase 3 (Production Readiness)
- **Focus**: Security, performance, deployment readiness
- **Critical**: All security checks pass, rollback plan exists
- **Cannot defer**: Anything marked REQUIRED

---

## Lessons Learned

After each gate check, document:

1. **What worked well**: [Process strengths]
2. **What didn't work**: [Process weaknesses]
3. **Improvements for next time**: [Action items]
4. **Time spent**: [Duration of gate check]

This protocol is a living document. Update based on experience.

---

## References

- [Code Review Checklist](./CODE_REVIEW.md) (if exists)
- [Testing Strategy](./TESTING.md) (if exists)
- [Security Guidelines](./SECURITY.md) (if exists)
- [Deployment Runbook](./DEPLOYMENT.md) (if exists)

---

**Remember**: The goal is quality, not bureaucracy. If a check doesn't apply, mark it N/A with justification. Adapt this protocol to your team's needs.
