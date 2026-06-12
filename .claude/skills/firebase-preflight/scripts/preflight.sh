#!/usr/bin/env bash
# Firebase Preflight Check
# Validates Firebase project configuration before deployment.
# Exit codes: 0 = all checks pass, 1 = hard failure, 2 = warnings only

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Track results
HARD_FAILURES=0
WARNINGS=0
CHECKS_PASSED=0

# Path to known-projects registry
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KNOWN_PROJECTS_FILE="$SCRIPT_DIR/../references/known-projects.json"

# Target directory (default: current directory)
TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

echo ""
echo -e "${BOLD}Firebase Preflight Check${NC}"
echo -e "${BOLD}========================${NC}"
echo -e "Directory: $(pwd)"
echo ""

# Helper functions
pass() {
    echo -e "  ${GREEN}✓ PASS${NC}  $1"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
}

fail() {
    echo -e "  ${RED}✗ FAIL${NC}  $1"
    if [ -n "${2:-}" ]; then
        echo -e "         ${RED}Fix:${NC} $2"
    fi
    HARD_FAILURES=$((HARD_FAILURES + 1))
}

warn() {
    echo -e "  ${YELLOW}⚠ WARN${NC}  $1"
    if [ -n "${2:-}" ]; then
        echo -e "         ${YELLOW}Suggestion:${NC} $2"
    fi
    WARNINGS=$((WARNINGS + 1))
}

info() {
    echo -e "  ${BLUE}ℹ INFO${NC}  $1"
}

# ─── Check 1: firebase.json exists ───────────────────────────────────────────
echo -e "${BOLD}Configuration Files${NC}"

if [ ! -f "firebase.json" ]; then
    fail "firebase.json not found" "Run /firebase-init to set up Firebase for this project"
else
    pass "firebase.json exists"

    # Parse firebase.json for later checks
    FIREBASE_JSON=$(cat firebase.json)
fi

# ─── Check 2: .firebaserc exists with projects.default ──────────────────────
if [ ! -f ".firebaserc" ]; then
    fail ".firebaserc not found" "Run /firebase-init to set up Firebase for this project"
else
    # Extract project ID
    PROJECT_ID=$(python3 -c "import json; print(json.load(open('.firebaserc'))['projects']['default'])" 2>/dev/null || echo "")
    if [ -z "$PROJECT_ID" ]; then
        fail ".firebaserc missing projects.default" "Add a default project: firebase use --add"
    else
        pass ".firebaserc has default project: $PROJECT_ID"
    fi
fi

# ─── Check 3: hosting.site on multi-site projects ───────────────────────────
echo ""
echo -e "${BOLD}Hosting Configuration${NC}"

if [ -f "firebase.json" ] && [ -n "${PROJECT_ID:-}" ]; then
    # Check if firebase.json has hosting config
    HAS_HOSTING=$(python3 -c "import json; d=json.load(open('firebase.json')); print('yes' if 'hosting' in d else 'no')" 2>/dev/null || echo "no")

    if [ "$HAS_HOSTING" = "yes" ]; then
        # Extract site name
        SITE_NAME=$(python3 -c "import json; d=json.load(open('firebase.json')); h=d['hosting']; print(h.get('site','') if isinstance(h,dict) else '')" 2>/dev/null || echo "")

        # Check known-projects registry
        if [ -f "$KNOWN_PROJECTS_FILE" ]; then
            IS_MULTI_SITE=$(python3 -c "
import json
registry = json.load(open('$KNOWN_PROJECTS_FILE'))
project = registry.get('$PROJECT_ID', {})
print('yes' if project.get('multi_site', False) else 'no')
" 2>/dev/null || echo "unknown")
        else
            IS_MULTI_SITE="unknown"
        fi

        if [ -z "$SITE_NAME" ]; then
            if [ "$IS_MULTI_SITE" = "yes" ]; then
                fail "hosting.site is missing — project '$PROJECT_ID' hosts multiple sites" \
                     "Add \"site\": \"your-site-name\" to the hosting section of firebase.json"
            elif [ "$IS_MULTI_SITE" = "unknown" ]; then
                warn "hosting.site is missing and project '$PROJECT_ID' is not in the known-projects registry" \
                     "Add \"site\": \"your-site-name\" to firebase.json for safety"
            else
                warn "hosting.site is not set" \
                     "Consider adding \"site\": \"your-site-name\" to firebase.json for clarity"
            fi
        else
            pass "hosting.site is set: $SITE_NAME"

            # Check if site is registered in known-projects
            if [ -f "$KNOWN_PROJECTS_FILE" ]; then
                IS_KNOWN_SITE=$(python3 -c "
import json
registry = json.load(open('$KNOWN_PROJECTS_FILE'))
project = registry.get('$PROJECT_ID', {})
sites = project.get('known_sites', [])
print('yes' if '$SITE_NAME' in sites else 'no')
" 2>/dev/null || echo "unknown")
                if [ "$IS_KNOWN_SITE" = "no" ]; then
                    warn "Site '$SITE_NAME' is not registered in known-projects.json" \
                         "Run /firebase-init or manually add it to the registry"
                else
                    info "Site '$SITE_NAME' is registered in known-projects.json"
                fi
            fi
        fi

        # Extract public directory
        PUBLIC_DIR=$(python3 -c "import json; d=json.load(open('firebase.json')); h=d['hosting']; print(h.get('public','') if isinstance(h,dict) else '')" 2>/dev/null || echo "")
    else
        info "No hosting configuration in firebase.json"
        PUBLIC_DIR=""
    fi
fi

# ─── Check 3b: Firestore database scoping ────────────────────────────────────
echo ""
echo -e "${BOLD}Firestore Configuration${NC}"

FIRESTORE_DB_NAME=""
if [ -f "firebase.json" ] && [ -n "${PROJECT_ID:-}" ]; then
    HAS_FIRESTORE=$(python3 -c "import json; d=json.load(open('firebase.json')); print('yes' if 'firestore' in d else 'no')" 2>/dev/null || echo "no")

    if [ "$HAS_FIRESTORE" = "yes" ]; then
        # Extract database name (supports both object and array format)
        FIRESTORE_DB_NAME=$(python3 -c "
import json
d = json.load(open('firebase.json'))
fs = d.get('firestore', {})
if isinstance(fs, list):
    db = fs[0].get('database', '') if fs else ''
elif isinstance(fs, dict):
    db = fs.get('database', '')
else:
    db = ''
print(db)
" 2>/dev/null || echo "")

        if [ -z "$FIRESTORE_DB_NAME" ] || [ "$FIRESTORE_DB_NAME" = "(default)" ]; then
            if [ "${IS_MULTI_SITE:-no}" = "yes" ]; then
                fail "Firestore targets '(default)' database on multi-site project '$PROJECT_ID'" \
                     "Add \"database\": \"your-db-name\" to the firestore section of firebase.json. Use the same name as your hosting site."
            else
                warn "Firestore targets '(default)' database — rules deploy will affect all apps sharing this database" \
                     "Consider adding \"database\": \"your-db-name\" to firebase.json for isolation"
            fi
        else
            pass "Firestore database is scoped: $FIRESTORE_DB_NAME"

            # Check if database is registered in known-projects
            if [ -f "$KNOWN_PROJECTS_FILE" ]; then
                IS_KNOWN_DB=$(python3 -c "
import json
registry = json.load(open('$KNOWN_PROJECTS_FILE'))
project = registry.get('$PROJECT_ID', {})
dbs = project.get('known_databases', [])
print('yes' if '$FIRESTORE_DB_NAME' in dbs else 'no')
" 2>/dev/null || echo "unknown")
                if [ "$IS_KNOWN_DB" = "no" ]; then
                    warn "Database '$FIRESTORE_DB_NAME' is not registered in known-projects.json" \
                         "Run /firebase-init or manually add it to the registry"
                else
                    info "Database '$FIRESTORE_DB_NAME' is registered in known-projects.json"
                fi
            fi
        fi
    else
        info "No Firestore configuration in firebase.json"
    fi
fi

# ─── Check 4: Public directory exists and is non-empty ──────────────────────
echo ""
echo -e "${BOLD}Build Artifacts${NC}"

if [ -n "${PUBLIC_DIR:-}" ]; then
    if [ ! -d "$PUBLIC_DIR" ]; then
        fail "Public directory '$PUBLIC_DIR' does not exist" \
             "Run your build command (e.g., npm run build) to generate it"
    elif [ -z "$(ls -A "$PUBLIC_DIR" 2>/dev/null)" ]; then
        fail "Public directory '$PUBLIC_DIR' is empty" \
             "Run your build command (e.g., npm run build) to populate it"
    else
        FILE_COUNT=$(find "$PUBLIC_DIR" -type f | wc -l | tr -d ' ')
        pass "Public directory '$PUBLIC_DIR' exists ($FILE_COUNT files)"
    fi

    # ─── Check 5: Build freshness ───────────────────────────────────────────
    if [ -d "$PUBLIC_DIR" ] && [ -f "package.json" ]; then
        # Find newest source file (excluding node_modules, public dir, and dot dirs)
        NEWEST_SOURCE=$(find . -type f \
            -not -path "./$PUBLIC_DIR/*" \
            -not -path "./node_modules/*" \
            -not -path "./.git/*" \
            -not -path "./.firebase/*" \
            -not -name "*.log" \
            \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.vue" -o -name "*.svelte" -o -name "*.css" -o -name "*.scss" -o -name "*.html" \) \
            -newer "$PUBLIC_DIR" -print -quit 2>/dev/null || echo "")

        if [ -n "$NEWEST_SOURCE" ]; then
            warn "Source files are newer than build artifacts in '$PUBLIC_DIR'" \
                 "Run your build command before deploying to ensure artifacts are up to date"
        else
            pass "Build artifacts appear up to date"
        fi
    fi
else
    if [ -f "firebase.json" ] && [ "${HAS_HOSTING:-no}" = "yes" ]; then
        fail "Could not determine public directory from firebase.json"
    else
        info "No hosting public directory to check (no hosting config)"
    fi
fi

# ─── Check 6: Firebase CLI installed ────────────────────────────────────────
echo ""
echo -e "${BOLD}Firebase CLI${NC}"

if ! command -v firebase &>/dev/null; then
    fail "Firebase CLI is not installed" \
         "Install with: npm install -g firebase-tools"
else
    FIREBASE_VERSION=$(firebase --version 2>/dev/null || echo "unknown")
    pass "Firebase CLI installed (v$FIREBASE_VERSION)"
fi

# ─── Check 7: Firebase authentication ───────────────────────────────────────
if command -v firebase &>/dev/null; then
    AUTH_OUTPUT=$(firebase login:list 2>&1 || true)
    if echo "$AUTH_OUTPUT" | grep -q "No authorized accounts"; then
        fail "Not authenticated with Firebase" \
             "Run: firebase login"
    elif echo "$AUTH_OUTPUT" | grep -qi "logged in as\|email"; then
        pass "Authenticated with Firebase"
    else
        warn "Could not determine Firebase auth status" \
             "Run 'firebase login:list' to check manually"
    fi
fi

# ─── Check 8: Detect other configured services ─────────────────────────────
echo ""
echo -e "${BOLD}Configured Services${NC}"

if [ -f "firebase.json" ]; then
    SERVICES=$(python3 -c "
import json
d = json.load(open('firebase.json'))
services = []
if 'hosting' in d: services.append('hosting')
if 'functions' in d: services.append('functions')
if 'firestore' in d: services.append('firestore')
if 'storage' in d: services.append('storage')
if 'database' in d: services.append('database')
if 'emulators' in d: services.append('emulators')
print(' '.join(services))
" 2>/dev/null || echo "")

    if [ -n "$SERVICES" ]; then
        for svc in $SERVICES; do
            if [ "$svc" = "firestore" ]; then
                if [ -n "${FIRESTORE_DB_NAME:-}" ] && [ "$FIRESTORE_DB_NAME" != "(default)" ] && [ -n "$FIRESTORE_DB_NAME" ]; then
                    info "Configured: $svc (database: $FIRESTORE_DB_NAME — scoped, safe)"
                else
                    info "Configured: $svc (⚠ shared-impact — targets (default) database)"
                fi
            elif [ "$svc" = "functions" ] || [ "$svc" = "storage" ]; then
                info "Configured: $svc (⚠ shared-impact — affects all apps in project)"
            else
                info "Configured: $svc"
            fi
        done
    else
        info "No services detected in firebase.json"
    fi
fi

# ─── Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}─────────────────────────────${NC}"

if [ "$HARD_FAILURES" -gt 0 ]; then
    echo -e "${RED}${BOLD}PREFLIGHT FAILED${NC} — $HARD_FAILURES failure(s), $WARNINGS warning(s), $CHECKS_PASSED check(s) passed"
    echo -e "${RED}Fix the failures above before deploying.${NC}"
    echo ""
    exit 1
elif [ "$WARNINGS" -gt 0 ]; then
    echo -e "${YELLOW}${BOLD}PREFLIGHT PASSED WITH WARNINGS${NC} — $WARNINGS warning(s), $CHECKS_PASSED check(s) passed"
    echo -e "${YELLOW}Review the warnings above before deploying.${NC}"
    echo ""
    exit 2
else
    echo -e "${GREEN}${BOLD}PREFLIGHT PASSED${NC} — $CHECKS_PASSED check(s) passed"
    echo -e "${GREEN}Ready to deploy.${NC}"
    echo ""
    exit 0
fi
