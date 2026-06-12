---
name: firebase-preflight
description: Validates Firebase configuration before deploy. Runs preflight checks on firebase.json, .firebaserc, hosting.site, public/dist directory, build freshness, CLI auth, and multi-site safety. Use when the user runs /firebase-preflight, before Firebase deploy, or when troubleshooting hosting/Firestore targeting.
---

# Firebase Preflight (`/firebase-preflight`)

## When to use

- User invokes **firebase-preflight** or **/firebase-preflight**
- Before any **Firebase deploy** (especially hosting)
- Debugging wrong site, empty deploy, or shared-project overwrites

## How to run

1. **Find the app directory** that contains `firebase.json` (e.g. `Users/someone/my-app`, `Projects/foo`). If the user is in that folder, use `.`.

2. **Repo root** (directory containing `.claude/skills/`):

```bash
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
bash "$REPO_ROOT/.claude/skills/firebase-preflight/scripts/preflight.sh" "<path-to-directory-with-firebase.json>"
```

Example for Competrix:

```bash
bash "$REPO_ROOT/.claude/skills/firebase-preflight/scripts/preflight.sh" "Users/smanchanda/competrix"
```

Use paths relative to **current directory** when invoking the script: the script `cd`s into the first argument.

## What the script checks

| Severity | Check |
|----------|--------|
| **FAIL** | `firebase.json` exists |
| **FAIL** | `.firebaserc` with `projects.default` |
| **FAIL** | On multi-site projects: `hosting` entries must set **`site`** (avoids wiping other teams’ sites) |
| **FAIL** | On multi-site projects: Firestore may need **`database`** ≠ `(default)` when rules are per-app |
| **FAIL** | Public/output directory exists and is non-empty |
| **FAIL** | `firebase` CLI available; user logged in (`firebase login`) |
| **WARN** | Source files newer than build artifacts (stale `dist`) |
| **INFO** | Lists functions, firestore, etc. and shared-impact services |

Exit codes: **0** = OK, **2** = warnings only, **1** = do not deploy.

## After failures

- Missing config → **`/firebase-init`** (or manual `firebase.json` / `.firebaserc`).
- Missing **`hosting.site`** on multi-site → add `"site": "<registered-site-id>"` to the correct hosting block. See registry: `.claude/skills/firebase-preflight/references/known-projects.json`.
- Empty public dir → run the project’s build (`npm run build`, etc.) so `dist`/`public` is populated.
- Deeper patterns → read `.claude/skills/firebase-preflight/references/safe-deploy-patterns.md`.

## Guardrails

- Do **not** say deploy is safe if exit code is **1**.
- Always call out missing **`site`** on known multi-site projects as critical.
- Scoped deploy: prefer **`firebase deploy --only hosting:TARGET`** (or site-specific flags) per team conventions; see **firebase-deploy** skill.

## Reference (read if needed)

- `.claude/skills/firebase-preflight/references/known-projects.json`
- `.claude/skills/firebase-preflight/references/safe-deploy-patterns.md`
