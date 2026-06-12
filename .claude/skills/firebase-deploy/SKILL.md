---
name: firebase-deploy
description: Safely deploy Firebase projects with mandatory scoping. Runs preflight checks, detects services, constructs scoped deploy commands (always uses --only and --project), and requires user confirmation. Prevents accidental overwrites on multi-site projects. Use when deploying any Firebase-hosted app.
---

# Firebase Safe Deploy

## Purpose

Deploy Firebase projects safely by enforcing scoped commands that prevent accidentally overwriting other people's apps. This skill is the ONLY approved way to deploy Firebase projects in this repository.

## Critical Safety Rules

**These rules are non-negotiable. Never bypass them.**

1. **NEVER** generate `firebase deploy` without `--only` and `--project` flags
2. **NEVER** use `--only hosting` without `:SITE_NAME` on a multi-site project
3. **ALWAYS** show the exact deploy command and get user confirmation before executing
4. **ALWAYS** run preflight checks before deploying — abort on any hard failure
5. **ALWAYS** warn prominently when deploying shared-impact targets (functions, storage rules, firestore rules targeting `(default)` database)
6. **NEVER** deploy Firestore rules on a multi-site project if `firestore.database` is missing or set to `(default)` — preflight will catch this

## Process

### 1. Run Preflight Checks (Hard Gate)

Run the preflight script first:

```bash
bash .claude/skills/firebase-preflight/scripts/preflight.sh <target_directory>
```

**If preflight returns exit code 1 (hard failure): STOP. Do not proceed with deployment.** Help the user fix the issues first.

If preflight returns exit code 2 (warnings only): Proceed but highlight the warnings to the user.

### 2. Detect Build Requirements

Check if the project needs to be built before deploying:

1. Look for `package.json` in the project directory
2. Check if a build script exists: `npm run build` or similar
3. Check if the public directory (from `firebase.json`) exists and is populated
4. If source files are newer than build artifacts, recommend running the build

**Ask the user if they want to run the build.** Do not auto-build without confirmation. Common build commands:
- `npm run build` (most projects)
- `npm run build -- --mode production` (Vite with env modes)
- `npx vite build` (direct Vite)

### 3. Determine Deploy Targets

Read `firebase.json` to detect configured services:

| Service | Deploy Flag | Shared Impact? |
|---------|------------|----------------|
| Hosting | `--only hosting:SITE_NAME` | No (site-scoped) |
| Functions | `--only functions` | **YES** — project-wide |
| Firestore rules (named DB) | `--only firestore:rules` | No (database-scoped via `firestore.database` in firebase.json) |
| Firestore rules (`(default)` DB) | `--only firestore:rules` | **YES** — affects all apps sharing `(default)` |
| Storage rules | `--only storage` | **YES** — project-wide |

Firestore rules are scoped by the `firestore.database` field in `firebase.json`. When a project uses a named database (not `(default)`), deploying Firestore rules only affects that specific database. When targeting `(default)`, it's shared-impact.

Present the available targets to the user and ask what they want to deploy. Default suggestion: hosting only (safest).

### 4. Construct the Deploy Command

Build the command following these patterns:

**Hosting only (most common):**
```bash
firebase deploy --only hosting:SITE_NAME --project PROJECT_ID
```

**Functions only:**
```bash
firebase deploy --only functions --project PROJECT_ID
```

**Multiple targets:**
```bash
firebase deploy --only hosting:SITE_NAME,functions --project PROJECT_ID
```

Read project ID from `.firebaserc` and site name from `firebase.json`.

### 5. Show Deploy Summary and Confirm

Present a clear summary before executing:

```
Deploy Summary
══════════════
Command:   firebase deploy --only hosting:agency-breakdown --project vendasta-citizen-developers
Project:   vendasta-citizen-developers
Site:      agency-breakdown
Directory: Users/bgaudet/subscription-calculator/
```

If any shared-impact targets are included, add a prominent warning:

```
⚠ WARNING: This deployment includes shared-impact targets.
  Functions and Storage rules affect ALL apps in this project.
  Firestore rules targeting (default) database affect ALL apps sharing that database.
  Make sure you've coordinated with other developers.
```

Note: Firestore rules targeting a named database (via `firestore.database` in firebase.json) are NOT shared-impact — they only affect that specific database.

**Wait for explicit user confirmation before executing.**

### 6. Execute and Report

Run the deploy command. On success, report the hosting URL:
```
✓ Deploy successful!
  Live at: https://SITE_NAME.web.app
```

On failure, read the troubleshooting guide:
```
.claude/skills/firebase-deploy/references/troubleshooting.md
```

### 7. Preview Channel Option

If the user seems uncertain or wants to test first, suggest a preview channel:
```bash
firebase hosting:channel:deploy preview --project PROJECT_ID --only hosting:SITE_NAME
```

This deploys to a temporary URL (expires in 7 days) instead of production.

## Alternative: Run the Deploy Script Directly

For a fully interactive experience, you can run the deploy script:

```bash
bash .claude/skills/firebase-deploy/scripts/deploy.sh <target_directory>
```

For a dry run (shows commands without executing):
```bash
bash .claude/skills/firebase-deploy/scripts/deploy.sh <target_directory> --dry-run
```

## Reference Files

- [Troubleshooting Guide](references/troubleshooting.md) — Common deployment errors and fixes
- [Known Projects Registry](../firebase-preflight/references/known-projects.json) — Multi-site project info
- [Safe Deploy Patterns](../firebase-preflight/references/safe-deploy-patterns.md) — Why scoped deploys matter
