#!/bin/bash

# Pre-commit hook setup script
# This sets up git hooks to run checks before committing

echo "Setting up pre-commit hooks..."

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

echo "Running pre-commit checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if any checks fail
FAILED=0

# Check for large files
echo "Checking for large files..."
LARGE_FILES=$(find . -type f -size +5M ! -path "./node_modules/*" ! -path "./.git/*" ! -path "./data/*" ! -path "./dist/*" 2>/dev/null)
if [ ! -z "$LARGE_FILES" ]; then
    echo -e "${YELLOW}Warning: Large files detected (>5MB):${NC}"
    echo "$LARGE_FILES"
    echo "Consider using Git LFS for large files."
fi

# Run backend tests if backend files changed
if git diff --cached --name-only | grep -q "^src/"; then
    echo "Running backend tests..."
    npm test 2>&1 | tail -5
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Backend tests failed${NC}"
        FAILED=1
    else
        echo -e "${GREEN}✓ Backend tests passed${NC}"
    fi
fi

# Run frontend lint if frontend files changed
if git diff --cached --name-only | grep -q "^chess-analyzer-frontend/"; then
    echo "Running frontend lint..."
    cd chess-analyzer-frontend && npm run lint
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Frontend lint failed${NC}"
        FAILED=1
    else
        echo -e "${GREEN}✓ Frontend lint passed${NC}"
    fi
    cd ..
fi

# Check for console.log in staged files
echo "Checking for console.log statements..."
CONSOLE_COUNT=$(git diff --cached --name-only --diff-filter=ACM | xargs grep -l "console\." 2>/dev/null | wc -l)
if [ "$CONSOLE_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}Warning: Found console statements in $CONSOLE_COUNT file(s)${NC}"
    git diff --cached --name-only --diff-filter=ACM | xargs grep -n "console\." 2>/dev/null | head -5
fi

# Check for merge conflicts
echo "Checking for merge conflicts..."
if git diff --cached --name-only | xargs grep -l "^<<<<<<< \|^======= \|^>>>>>>> " 2>/dev/null; then
    echo -e "${RED}✗ Merge conflict markers found${NC}"
    FAILED=1
fi

if [ $FAILED -ne 0 ]; then
    echo -e "${RED}Pre-commit checks failed. Please fix the issues above and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All pre-commit checks passed!${NC}"
exit 0
EOF

# Make the hook executable
chmod +x .git/hooks/pre-commit

echo "✓ Pre-commit hook installed successfully!"
echo ""
echo "The hook will run automatically before each commit and check:"
echo "  - Large files (>5MB)"
echo "  - Backend tests (if backend files changed)"
echo "  - Frontend lint (if frontend files changed)"
echo "  - Console.log statements"
echo "  - Merge conflict markers"
echo ""
echo "To skip hooks temporarily, use: git commit --no-verify"