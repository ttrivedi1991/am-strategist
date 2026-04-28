#!/bin/bash
# Auto-sync: pull remote changes, push local commits
REPO="/Users/ttrivedi/am-strategist"
LOG="$REPO/git-sync.log"
GIT="/usr/bin/git"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

cd "$REPO" || exit 1

# Pull any remote changes (rebase keeps history clean)
PULL_OUT=$($GIT pull --rebase 2>&1)
PULL_EXIT=$?

# Push any unpushed local commits
PUSH_OUT=$($GIT push 2>&1)
PUSH_EXIT=$?

echo "[$TIMESTAMP] pull(${PULL_EXIT}): $PULL_OUT | push(${PUSH_EXIT}): $PUSH_OUT" >> "$LOG"

# Keep log from growing forever (last 500 lines)
tail -n 500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
