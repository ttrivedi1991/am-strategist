#!/usr/bin/env bash
# Firebase Safe Deploy Script
# Constructs and displays a scoped deploy command. Requires user confirmation.
# Usage: deploy.sh [target_directory] [--dry-run]

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

# Resolve script paths before changing directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse arguments
TARGET_DIR="${1:-.}"
DRY_RUN=false
for arg in "$@"; do
    if [ "$arg" = "--dry-run" ]; then
        DRY_RUN=true
    fi
done

cd "$TARGET_DIR"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
PREFLIGHT_SCRIPT="$REPO_ROOT/.claude/skills/firebase-preflight/scripts/preflight.sh"
KNOWN_PROJECTS_FILE="$REPO_ROOT/.claude/skills/firebase-preflight/references/known-projects.json"

# ─── Step 1: Run preflight ──────────────────────────────────────────────────
echo -e "${BOLD}Running preflight checks...${NC}"
echo ""

PREFLIGHT_EXIT=0
bash "$PREFLIGHT_SCRIPT" "$(pwd)" || PREFLIGHT_EXIT=$?

if [ "$PREFLIGHT_EXIT" -eq 1 ]; then
    echo ""
    echo -e "${RED}${BOLD}DEPLOY ABORTED${NC} — Preflight checks failed. Fix the issues above before deploying."
    exit 1
fi

# ─── Step 2: Read configuration ─────────────────────────────────────────────
PROJECT_ID=$(python3 -c "import json; print(json.load(open('.firebaserc'))['projects']['default'])")

# Detect configured services
SERVICES_JSON=$(python3 -c "
import json
d = json.load(open('firebase.json'))
services = {}
if 'hosting' in d:
    h = d['hosting']
    site = h.get('site', '') if isinstance(h, dict) else ''
    public = h.get('public', '') if isinstance(h, dict) else ''
    services['hosting'] = {'site': site, 'public': public}
if 'functions' in d:
    services['functions'] = True
if 'firestore' in d:
    services['firestore'] = True
if 'storage' in d:
    services['storage'] = True
if 'database' in d:
    services['database'] = True
print(json.dumps(services))
")

HAS_HOSTING=$(python3 -c "import json; d=json.loads('$SERVICES_JSON'); print('yes' if 'hosting' in d else 'no')")
SITE_NAME=$(python3 -c "import json; d=json.loads('$SERVICES_JSON'); print(d.get('hosting',{}).get('site','') if isinstance(d.get('hosting'),dict) else '')" 2>/dev/null || echo "")
HAS_FUNCTIONS=$(python3 -c "import json; d=json.loads('$SERVICES_JSON'); print('yes' if 'functions' in d else 'no')")
HAS_FIRESTORE=$(python3 -c "import json; d=json.loads('$SERVICES_JSON'); print('yes' if 'firestore' in d else 'no')")
HAS_STORAGE=$(python3 -c "import json; d=json.loads('$SERVICES_JSON'); print('yes' if 'storage' in d else 'no')")

# Extract Firestore database name
FIRESTORE_DB_NAME=""
if [ "$HAS_FIRESTORE" = "yes" ]; then
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
fi
FIRESTORE_IS_SCOPED="no"
if [ -n "$FIRESTORE_DB_NAME" ] && [ "$FIRESTORE_DB_NAME" != "(default)" ]; then
    FIRESTORE_IS_SCOPED="yes"
fi

# Check if multi-site project
IS_MULTI_SITE="no"
if [ -f "$KNOWN_PROJECTS_FILE" ]; then
    IS_MULTI_SITE=$(python3 -c "
import json
registry = json.load(open('$KNOWN_PROJECTS_FILE'))
project = registry.get('$PROJECT_ID', {})
print('yes' if project.get('multi_site', False) else 'no')
" 2>/dev/null || echo "no")
fi

# ─── Step 3: Show available deploy targets ───────────────────────────────────
echo ""
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo -e "${BOLD}  Firebase Deploy — $(pwd)${NC}"
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo ""
echo -e "  Project:  ${BLUE}$PROJECT_ID${NC}"
if [ -n "$SITE_NAME" ]; then
    echo -e "  Site:     ${BLUE}$SITE_NAME${NC}"
fi
echo ""
echo -e "${BOLD}Available deploy targets:${NC}"

TARGET_NUM=0
TARGETS=()

if [ "$HAS_HOSTING" = "yes" ]; then
    TARGET_NUM=$((TARGET_NUM + 1))
    if [ -n "$SITE_NAME" ]; then
        echo -e "  ${TARGET_NUM}) Hosting (site: $SITE_NAME)"
        TARGETS+=("hosting:$SITE_NAME")
    else
        echo -e "  ${TARGET_NUM}) Hosting ${YELLOW}(⚠ no site name configured)${NC}"
        TARGETS+=("hosting")
    fi
fi

if [ "$HAS_FUNCTIONS" = "yes" ]; then
    TARGET_NUM=$((TARGET_NUM + 1))
    echo -e "  ${TARGET_NUM}) Functions ${YELLOW}(⚠ shared-impact: affects all apps in project)${NC}"
    TARGETS+=("functions")
fi

if [ "$HAS_FIRESTORE" = "yes" ]; then
    TARGET_NUM=$((TARGET_NUM + 1))
    if [ "$FIRESTORE_IS_SCOPED" = "yes" ]; then
        echo -e "  ${TARGET_NUM}) Firestore rules (database: $FIRESTORE_DB_NAME — scoped)"
    else
        echo -e "  ${TARGET_NUM}) Firestore rules ${YELLOW}(⚠ shared-impact: targets (default) database)${NC}"
    fi
    TARGETS+=("firestore")
fi

if [ "$HAS_STORAGE" = "yes" ]; then
    TARGET_NUM=$((TARGET_NUM + 1))
    echo -e "  ${TARGET_NUM}) Storage rules ${YELLOW}(⚠ shared-impact: affects all apps in project)${NC}"
    TARGETS+=("storage")
fi

if [ "$TARGET_NUM" -gt 1 ]; then
    TARGET_NUM=$((TARGET_NUM + 1))
    echo -e "  ${TARGET_NUM}) All of the above"
    TARGETS+=("all")
fi

echo ""

# ─── Step 4: Prompt for selection (handled by calling agent) ─────────────────
# This script outputs the deploy summary. The calling agent (SKILL.md)
# handles the interactive selection and confirmation flow.
# For automated/dry-run mode, we construct the command for all targets.

if [ "$DRY_RUN" = true ]; then
    echo -e "${BOLD}Dry run — showing commands for each target:${NC}"
    echo ""

    for i in "${!TARGETS[@]}"; do
        target="${TARGETS[$i]}"
        if [ "$target" = "all" ]; then
            # Build the "all" command from other targets
            ALL_TARGETS=""
            for t in "${TARGETS[@]}"; do
                if [ "$t" != "all" ]; then
                    if [ -n "$ALL_TARGETS" ]; then
                        ALL_TARGETS="$ALL_TARGETS,$t"
                    else
                        ALL_TARGETS="$t"
                    fi
                fi
            done
            echo -e "  All:       firebase deploy --only $ALL_TARGETS --project $PROJECT_ID"
        else
            LABEL=$(echo "$target" | cut -d: -f1)
            echo -e "  $LABEL:   firebase deploy --only $target --project $PROJECT_ID"
        fi
    done

    echo ""

    # Safety validation
    echo -e "${BOLD}Safety checks:${NC}"
    SAFE=true

    # Check: no bare hosting on multi-site
    if [ "$HAS_HOSTING" = "yes" ] && [ -z "$SITE_NAME" ] && [ "$IS_MULTI_SITE" = "yes" ]; then
        echo -e "  ${RED}✗ UNSAFE: Hosting target is bare (no site name) on multi-site project${NC}"
        SAFE=false
    else
        echo -e "  ${GREEN}✓ Hosting target is properly scoped${NC}"
    fi

    # Check: --project always present
    echo -e "  ${GREEN}✓ --project flag present in all commands${NC}"

    # Check: --only always present
    echo -e "  ${GREEN}✓ --only flag present in all commands${NC}"

    if [ "$SAFE" = false ]; then
        echo ""
        echo -e "${RED}${BOLD}UNSAFE COMMANDS DETECTED — DO NOT DEPLOY${NC}"
        exit 1
    fi

    echo ""
    exit 0
fi

# Interactive mode — output selection prompt
echo -e "Enter the number of the target to deploy (or 'q' to quit):"
read -r SELECTION

if [ "$SELECTION" = "q" ] || [ "$SELECTION" = "Q" ]; then
    echo -e "${YELLOW}Deploy cancelled.${NC}"
    exit 0
fi

# Validate selection
if ! [[ "$SELECTION" =~ ^[0-9]+$ ]] || [ "$SELECTION" -lt 1 ] || [ "$SELECTION" -gt "$TARGET_NUM" ]; then
    echo -e "${RED}Invalid selection.${NC}"
    exit 1
fi

SELECTED_TARGET="${TARGETS[$((SELECTION-1))]}"

# Build the deploy command
if [ "$SELECTED_TARGET" = "all" ]; then
    ALL_TARGETS=""
    for t in "${TARGETS[@]}"; do
        if [ "$t" != "all" ]; then
            if [ -n "$ALL_TARGETS" ]; then
                ALL_TARGETS="$ALL_TARGETS,$t"
            else
                ALL_TARGETS="$t"
            fi
        fi
    done
    DEPLOY_CMD="firebase deploy --only $ALL_TARGETS --project $PROJECT_ID"
else
    DEPLOY_CMD="firebase deploy --only $SELECTED_TARGET --project $PROJECT_ID"
fi

# Safety gate: block bare hosting on multi-site
if echo "$DEPLOY_CMD" | grep -q -- "--only hosting" && ! echo "$DEPLOY_CMD" | grep -q -- "--only hosting:"; then
    if [ "$IS_MULTI_SITE" = "yes" ]; then
        echo ""
        echo -e "${RED}${BOLD}BLOCKED: Cannot deploy bare hosting on multi-site project '$PROJECT_ID'${NC}"
        echo -e "${RED}This would overwrite ALL hosting sites in the project.${NC}"
        echo -e "${RED}Add \"site\": \"your-site-name\" to firebase.json first.${NC}"
        exit 1
    fi
fi

# Shared-impact warning
HAS_SHARED_IMPACT=false
if echo "$DEPLOY_CMD" | grep -qE "(functions|storage)"; then
    HAS_SHARED_IMPACT=true
fi
# Firestore is only shared-impact when targeting (default) database
if echo "$DEPLOY_CMD" | grep -q "firestore" && [ "$FIRESTORE_IS_SCOPED" != "yes" ]; then
    HAS_SHARED_IMPACT=true
fi

echo ""
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo -e "${BOLD}  Deploy Summary${NC}"
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo ""
echo -e "  Command:  ${BLUE}$DEPLOY_CMD${NC}"
echo -e "  Project:  $PROJECT_ID"
echo -e "  Directory: $(pwd)"

if [ "$HAS_SHARED_IMPACT" = true ]; then
    echo ""
    echo -e "  ${YELLOW}${BOLD}⚠ WARNING: This deployment includes shared-impact targets.${NC}"
    echo -e "  ${YELLOW}  Functions and Firestore/Storage rules affect ALL apps in this project.${NC}"
    echo -e "  ${YELLOW}  Make sure you've coordinated with other developers.${NC}"
fi

echo ""
echo -e "Proceed with deployment? (yes/no):"
read -r CONFIRM

if [ "$CONFIRM" != "yes" ] && [ "$CONFIRM" != "y" ]; then
    echo -e "${YELLOW}Deploy cancelled.${NC}"
    exit 0
fi

# Execute deployment
echo ""
echo -e "${BOLD}Deploying...${NC}"
echo ""

eval "$DEPLOY_CMD"
DEPLOY_EXIT=$?

if [ "$DEPLOY_EXIT" -eq 0 ]; then
    echo ""
    echo -e "${GREEN}${BOLD}DEPLOY SUCCESSFUL${NC}"
    if [ -n "$SITE_NAME" ]; then
        echo -e "${GREEN}Your site is live at: https://$SITE_NAME.web.app${NC}"
    fi
else
    echo ""
    echo -e "${RED}${BOLD}DEPLOY FAILED${NC} — Check the error output above."
    echo -e "For troubleshooting, see: .claude/skills/firebase-deploy/references/troubleshooting.md"
    exit 1
fi
