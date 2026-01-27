#!/bin/bash

# Define colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "🛡️  Scanning for forbidden relative API calls in src/ ..."

# Search for patterns: fetch('/api, fetch("/api, axios.get('/api, etc.
# -r: recursive
# -n: show line number
# -E: extended regex
# We look for fetch/axios followed by quote then /api
ERRORS=$(grep -r -n -E "fetch\s*\(['\"\`]/api|axios\.[a-z]+\s*\(['\"\`]/api" src)

if [ -n "$ERRORS" ]; then
    echo -e "\n${RED}❌ FOUND FORBIDDEN RELATIVE API CALLS:${NC}"
    echo "$ERRORS"
    echo -e "\n${RED}🚫 FAIL: Relative API calls like fetch('/api...') are FORBIDDEN.${NC}"
    echo "   Please use buildApiUrl() from auth.js or VITE_API_URL."
    exit 1
else
    echo -e "${GREEN}✅ PASS: No relative API calls found.${NC}"
    exit 0
fi
