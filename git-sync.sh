#!/bin/bash
# Auto-sync: pull remote changes, push local commits.
# Auth: a file-based credential store (~/.am-strategist-git-credentials, 0600),
# NOT the macOS keychain — cron has no keychain session, so the gh credential
# helper fails there. The -c overrides clear any inherited helper and use only
# the file, so push works headlessly. To rotate: regenerate the file with
#   printf 'https://USER:%s@github.com\n' "$(gh auth token)" > ~/.am-strategist-git-credentials
# To switch to SSH later, point the remote at git@github.com and drop the -c's.
REPO="/Users/ttrivedi/am-strategist"
LOG="$REPO/git-sync.log"
CREDFILE="$HOME/.am-strategist-git-credentials"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

cd "$REPO" || exit 1

# Array keeps the "store --file=..." argument intact under word-splitting.
GIT=(/usr/bin/git -c credential.helper= -c "credential.helper=store --file=$CREDFILE")

PULL_OUT=$("${GIT[@]}" pull --rebase 2>&1)
PULL_EXIT=$?

PUSH_OUT=$("${GIT[@]}" push 2>&1)
PUSH_EXIT=$?

echo "[$TIMESTAMP] pull(${PULL_EXIT}): $PULL_OUT | push(${PUSH_EXIT}): $PUSH_OUT" >> "$LOG"

# Keep log from growing forever (last 500 lines)
tail -n 500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
