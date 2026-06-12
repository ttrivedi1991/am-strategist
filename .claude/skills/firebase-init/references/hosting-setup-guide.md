# Firebase Hosting Setup Guide

## Overview

This guide covers setting up Firebase Hosting for a new project in the citizen-developers repository. Every new hosting site must be properly configured with site scoping to prevent accidental cross-site deployments.

## Choosing a Firebase Project

### Available projects

| Project ID | Use Case | Multi-Site? |
|------------|----------|-------------|
| `vendasta-citizen-developers` | Default for citizen developer apps | Yes |
| `citdev-firebase` | Alternative citizen dev project | Yes |
| `ai-dashboard-489320` | AI/ML dashboards | No (currently) |

**Default choice**: `vendasta-citizen-developers` — unless you have a specific reason to use another project.

## Site Naming Convention

Site names must be globally unique across all Firebase projects. Follow this pattern:

```
{descriptive-name}
```

Examples:
- `agency-breakdown`
- `franchise-breakdown`
- `vendasta-subscription-calculator`
- `sales-enablement-dashboard`

Rules:
- Lowercase letters, numbers, and hyphens only
- Must be globally unique (Firebase will reject duplicates)
- Keep it descriptive but concise
- Avoid including "vendasta-" prefix unless needed for clarity

## Creating a Hosting Site

```bash
firebase hosting:sites:create SITE_NAME --project PROJECT_ID
```

This registers the site name. It can then be used in `firebase.json`:

```json
{
  "hosting": {
    "site": "SITE_NAME",
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

## Creating a Named Firestore Database

Each new project gets its own Firestore database with the same name as the hosting site. This isolates Firestore rules so deploying one app's rules doesn't affect another.

```bash
gcloud firestore databases create \
  --database=SITE_NAME \
  --location=northamerica-northeast1 \
  --project=PROJECT_ID
```

**Location**: Use `northamerica-northeast1` (Montréal) by default. Other options: `us-central1`, `us-east1`, `europe-west1`.

**Naming**: Use the same ID as the hosting site for consistency (e.g., site `agency-breakdown` → database `agency-breakdown`).

## Configuration Files

### firebase.json

The `hosting.site` and `firestore.database` fields are **mandatory**. They scope deployments to your specific site and database.

```json
{
  "hosting": {
    "site": "your-site-name",
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ]
  },
  "firestore": {
    "database": "your-site-name",
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

**Common `public` directory values:**
- `dist` — Vite, Vue CLI
- `build` — Create React App
- `out` — Next.js static export
- `public` — Static sites

### .firebaserc

```json
{
  "projects": {
    "default": "your-project-id"
  }
}
```

## Registering in known-projects.json

After creating a new site and database, update the registry at:
```
.claude/skills/firebase-preflight/references/known-projects.json
```

Add your site name to the `known_sites` array and your database name to the `known_databases` array.

## Post-Setup Validation

Run `/firebase-preflight` to validate your setup. All checks should pass before attempting any deployment.

## Common Issues

### "Firebase Hosting site already exists"
The site name is taken. Choose a different name.

### "Permission denied"
You don't have access to the Firebase project. Ask a project admin for access.

### "No project active"
Run `firebase use PROJECT_ID` or create `.firebaserc` with the project ID.
