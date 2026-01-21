#!/bin/bash
# gate-check.sh - Automated Gate Check Protocol
# Run before proceeding to next implementation phase

set -e  # Exit on error

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BOLD}🔍 HUMMBL MCP Server - Gate Check Protocol${NC}"
echo "================================================"
echo ""

# Track failures
FAILURES=0

# Function to run check
run_check() {
    local name="$1"
    local command="$2"

    echo -n "Checking: $name... "

    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        FAILURES=$((FAILURES + 1))
        return 1
    fi
}

# 1. Code Quality
echo -e "\n${BOLD}1. Code Quality ⚙️${NC}"
echo "-------------------"
run_check "TypeScript compilation" "npm run typecheck"
run_check "Linting" "npm run lint"
run_check "Code formatting" "npm run format:check"

# 2. Testing
echo -e "\n${BOLD}2. Testing 🧪${NC}"
echo "-------------------"
run_check "Test suite" "npm test"

# 3. Build
echo -e "\n${BOLD}3. Build Process 🏗️${NC}"
echo "-------------------"
run_check "Production build" "npm run build"

# 4. Dependencies
echo -e "\n${BOLD}4. Dependencies 📦${NC}"
echo "-------------------"
echo -n "Checking: Security vulnerabilities... "
AUDIT_OUTPUT=$(npm audit --audit-level=high 2>&1)
if echo "$AUDIT_OUTPUT" | grep -q "found 0 vulnerabilities"; then
    echo -e "${GREEN}✓ PASS${NC}"
elif echo "$AUDIT_OUTPUT" | grep -q "# Run  npm audit fix"; then
    echo -e "${YELLOW}⚠ WARNING - Fixable vulnerabilities found${NC}"
    echo "$AUDIT_OUTPUT"
else
    echo -e "${RED}✗ FAIL - Critical vulnerabilities found${NC}"
    echo "$AUDIT_OUTPUT"
    FAILURES=$((FAILURES + 1))
fi

# 5. Code Quality Checks
echo -e "\n${BOLD}5. Code Quality Scans 🔍${NC}"
echo "-------------------"

echo -n "Checking: TODO comments... "
TODO_COUNT=$(grep -r "TODO\|FIXME" src/ --exclude-dir=node_modules 2>/dev/null | wc -l | tr -d ' ')
if [ "$TODO_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓ PASS (0 TODOs)${NC}"
else
    echo -e "${YELLOW}⚠ $TODO_COUNT TODOs found${NC}"
    grep -r "TODO\|FIXME" src/ --exclude-dir=node_modules 2>/dev/null | head -5
    echo "  ... (review these before proceeding)"
fi

echo -n "Checking: Console statements... "
CONSOLE_COUNT=$(grep -r "console\.\(log\|debug\)" src/ --exclude-dir=node_modules --exclude="*.test.ts" 2>/dev/null | wc -l | tr -d ' ')
if [ "$CONSOLE_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${YELLOW}⚠ $CONSOLE_COUNT console statements found${NC}"
    grep -r "console\.\(log\|debug\)" src/ --exclude-dir=node_modules --exclude="*.test.ts" 2>/dev/null | head -3
fi

echo -n "Checking: Hardcoded secrets... "
SECRET_PATTERNS="password|api_key|secret|token|credential"
if grep -r -i "$SECRET_PATTERNS" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "\.test\.ts" | grep -q "="; then
    echo -e "${RED}✗ FAIL - Potential secrets found${NC}"
    grep -r -i "$SECRET_PATTERNS" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "\.test\.ts" | grep "=" | head -3
    FAILURES=$((FAILURES + 1))
else
    echo -e "${GREEN}✓ PASS${NC}"
fi

# 6. Documentation
echo -e "\n${BOLD}6. Documentation 📚${NC}"
echo "-------------------"

echo -n "Checking: README.md exists... "
if [ -f "README.md" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    FAILURES=$((FAILURES + 1))
fi

echo -n "Checking: CHANGELOG.md exists... "
if [ -f "CHANGELOG.md" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${YELLOW}⚠ WARNING${NC}"
fi

echo -n "Checking: Markdown links... "
if command -v markdown-link-check > /dev/null 2>&1; then
    if find . -name "*.md" -exec markdown-link-check {} \; > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
    else
        echo -e "${YELLOW}⚠ Some broken links${NC}"
    fi
else
    echo -e "${YELLOW}⚠ SKIP (markdown-link-check not installed)${NC}"
fi

# Summary
echo ""
echo "================================================"
echo -e "${BOLD}Gate Check Summary${NC}"
echo "================================================"

if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✅ ALL CHECKS PASSED${NC}"
    echo ""
    echo "Automated checks complete. Next steps:"
    echo "1. Review GATE_CHECK_PROTOCOL.md for manual checks"
    echo "2. Complete Phase-specific verification"
    echo "3. Update Decision Matrix in protocol doc"
    echo "4. Obtain sign-off from team leads"
    exit 0
else
    echo -e "${RED}${BOLD}❌ $FAILURES CHECK(S) FAILED${NC}"
    echo ""
    echo "Please fix the failures above before proceeding."
    echo "Review GATE_CHECK_PROTOCOL.md for detailed guidance."
    exit 1
fi
