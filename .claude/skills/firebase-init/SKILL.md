---
name: firebase-init
description: Set up Firebase Hosting and a dedicated Firestore database for a new project with proper scoping. Creates firebase.json with hosting.site and firestore.database, .firebaserc, a named Firestore DB, and registers in the known-projects registry. Use when starting a new web app that needs Firebase, or when a project is missing Firebase configuration.
---

# Firebase Init — New Project Setup

## Purpose

Set up Firebase Hosting and a dedicated Firestore database for a new project with all safety guardrails in place from the start. Ensures `hosting.site` and `firestore.database` are always populated, preventing the most dangerous misconfigurations in multi-site Firebase projects.

## Prerequisites

Before starting, verify:

1. **Firebase CLI installed**: `firebase --version`
   - If missing: `npm install -g firebase-tools`
2. **Authenticated**: `firebase login:list`
   - If not logged in: `firebase login`

## Process

### 1. Determine Project Location

Identify where the project lives in the repository:

- `Users/{userid}/{project-name}/` — Personal project
- `Projects/{project-name}/` — Collaborative project

If the user hasn't created the directory yet, help them create it in the appropriate location.

### 2. Choose Firebase Project

Ask the user which Firebase project to use. Read the hosting setup guide for available options:

```
.claude/skills/firebase-init/references/hosting-setup-guide.md
```

**Default recommendation**: `vendasta-citizen-developers`

Present the options:
| Project | Best For |
|---------|----------|
| `vendasta-citizen-developers` | Most citizen developer apps |
| `citdev-firebase` | Alternative if first project is full |
| `ai-dashboard-489320` | AI/ML specific dashboards |

### 3. Generate Site Name

Derive a site name from the project directory name:

1. Take the directory name (e.g., `my-cool-dashboard`)
2. Convert to lowercase, replace spaces with hyphens
3. Remove special characters
4. Ensure it's descriptive and unique

**Check if the name is already taken** by looking at the known-projects registry:
```
.claude/skills/firebase-preflight/references/known-projects.json
```

Present the suggested name and let the user approve or modify it.

### 4. Create the Hosting Site

Run:
```bash
firebase hosting:sites:create SITE_NAME --project PROJECT_ID
```

If the site name is taken, suggest alternatives and retry.

### 5. Create a Named Firestore Database

Each app gets its own Firestore database, using the **same name as the hosting site**. This ensures Firestore rules deployments are scoped and don't affect other apps sharing the project.

```bash
gcloud firestore databases create \
  --database=SITE_NAME \
  --location=northamerica-northeast1 \
  --project=PROJECT_ID
```

**Location choice**: Use `northamerica-northeast1` (Montréal) by default for Canadian data residency. Ask the user if they need a different region.

If the database already exists, `gcloud` will return an error — that's fine, just verify the name matches.

Also create starter Firestore files:

**`firestore.rules`**:

> ⚠️ **Do NOT ship `if request.auth != null` on this shared project.** Firebase
> Auth is project-scoped, not database-scoped — on a multi-app project like
> `vendasta-citizen-developers`, any ID token minted by *any* sibling app (some
> have open sign-in providers) satisfies `request.auth != null` and would get
> full read/write to your named database. Scope access to an explicit allowlist
> of the verified emails (or UIDs) that should use this app:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthorizedUser() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email in [
          'you@vendasta.com'  // replace with the real allowlist for this app
        ];
    }
    match /{document=**} {
      allow read, write: if isAuthorizedUser();
    }
  }
}
```

**`firestore.indexes.json`**:
```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

### 6. Generate firebase.json

Create `firebase.json` in the project directory. The `hosting.site` and `firestore.database` fields are **mandatory** — never omit them.

```json
{
  "hosting": {
    "site": "SITE_NAME",
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ]
  },
  "firestore": {
    "database": "SITE_NAME",
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

Ask the user about their build output directory:
- Vite → `dist` (default)
- Create React App → `build`
- Next.js export → `out`
- Static site → `public`

### 7. Generate .firebaserc

Create `.firebaserc` in the project directory:

```json
{
  "projects": {
    "default": "PROJECT_ID"
  }
}
```

### 8. Update Known Projects Registry

Add the new site and database to the registry at:
```
.claude/skills/firebase-preflight/references/known-projects.json
```

Add the site name to `known_sites` and the database name to `known_databases`. If the project is not yet in the registry, add it:

```json
{
  "project-id": {
    "multi_site": true,
    "known_sites": ["existing-site", "NEW_SITE_NAME"],
    "known_databases": ["(default)", "NEW_SITE_NAME"]
  }
}
```

Set `multi_site` to `true` if the project now has more than one site.

### 9. Run Preflight Validation

Run the preflight check to validate the new setup:

```bash
bash .claude/skills/firebase-preflight/scripts/preflight.sh <project_directory>
```

All checks should pass (except possibly build artifacts if the user hasn't built yet). Walk through any failures.

### 10. Next Steps

Tell the user:

1. **Build your app** — set up your web framework and run the build
2. **Deploy** — use `/firebase-deploy` when ready (never deploy manually)
3. **Your URL will be**: `https://SITE_NAME.web.app`

## Safety Guardrails

- **ALWAYS** include `hosting.site` in `firebase.json` — this is the whole point of this skill
- **ALWAYS** include `firestore.database` in `firebase.json` with the same name as the hosting site
- **ALWAYS** create a named Firestore database (never let new apps use `(default)`)
- **ALWAYS** update the known-projects registry after creating a new site and database
- **NEVER** generate `firebase.json` without the `site` and `database` fields
- Validate the setup with preflight before considering it complete

## Reference Files

- [Hosting Setup Guide](references/hosting-setup-guide.md) — Available projects, naming conventions, configuration details
- [Known Projects Registry](../firebase-preflight/references/known-projects.json) — Must be updated after init
