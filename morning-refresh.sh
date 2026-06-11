#!/bin/bash
# Morning refresh: pull live BigQuery billing data, commit if changed.
# git-sync.sh (every 2h) handles the push.
REPO="/Users/ttrivedi/am-strategist"
LOG="$REPO/refresh.log"
export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/Downloads/google-cloud-sdk/bin"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

cd "$REPO" || exit 1

OUT=$(node scripts/refresh-data.mjs 2>&1)
EXIT=$?

if [ $EXIT -eq 0 ] && ! git diff --quiet -- src/data/live.ts src/data/billingDocs.ts; then
  git add src/data/live.ts src/data/billingDocs.ts
  git commit --quiet -m "Auto-refresh: BigQuery billing data $(date +%Y-%m-%d)"
  OUT="$OUT | committed"
fi

echo "[$TIMESTAMP] refresh(${EXIT}): $(echo "$OUT" | tail -1)" >> "$LOG"
tail -n 200 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
