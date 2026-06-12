# Safe Firebase Deploy Patterns

## Why scoped deploys matter

Firebase projects can host multiple sites. A bare `firebase deploy --only hosting` deploys to **every** hosting site in the project, overwriting all of them with the current directory's content. This breaks other people's apps.

## Safe pattern: always scope hosting deploys

```bash
# SAFE — deploys only to the specific site
firebase deploy --only hosting:agency-breakdown --project vendasta-citizen-developers

# DANGEROUS — overwrites ALL sites in the project
firebase deploy --only hosting --project vendasta-citizen-developers

# DANGEROUS — deploys everything, no scoping at all
firebase deploy
```

## Multi-site projects in this repo

### vendasta-citizen-developers
- `agency-breakdown` — Users/bgaudet/subscription-calculator/
- `franchise-breakdown` — Users/bgaudet/Franchise Direct Pricing/

### citdev-firebase
- `vendasta-subscription-calculator` — Users/lochitwa/sales-enablement-dashboard/Subscription Earn Out and Profit Calculator/

### ai-dashboard-489320
- Single-site project (Projects/vendasta-ai-execution-leaderboard/)
- Still requires `--project` flag but site scoping is less critical

## Named Firestore databases: scoping rules like hosting

Firebase supports multiple named databases per project (not just `(default)`). Each app should have its own database so that Firestore rules deployments are scoped and don't affect other apps.

### Safe pattern: always scope Firestore to a named database

```bash
# SAFE — deploys rules only for the named database
firebase deploy --only firestore:rules --project vendasta-citizen-developers
# (with firebase.json containing "firestore.database": "agency-breakdown")

# DANGEROUS — deploys rules to (default) database, shared by all apps
firebase deploy --only firestore:rules --project vendasta-citizen-developers
# (with firebase.json pointing at "(default)" or missing database field)
```

### How it works in firebase.json

```json
{
  "firestore": {
    "database": "agency-breakdown",
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

The `database` field scopes which Firestore database the rules and indexes apply to. When each app has its own named database, deploying Firestore rules is **no longer a shared-impact operation**.

### Creating a named database

```bash
gcloud firestore databases create \
  --database=SITE_NAME \
  --location=northamerica-northeast1 \
  --project=PROJECT_ID
```

Use the same ID as the hosting site for consistency.

## Shared-impact targets

These Firebase services can be shared across all apps in a project **if not properly scoped**:
- **Firestore rules** — shared-impact ONLY when targeting `(default)` database. Safe when using a named database with `firestore.database` set.
- **Cloud Functions** — functions are project-wide, not site-specific
- **Storage rules** — shared across the project

Always warn prominently before deploying these (unless Firestore is scoped to a named database).

## The `hosting.site` field

Every `firebase.json` in a multi-site project MUST have the `hosting.site` field:

```json
{
  "hosting": {
    "site": "agency-breakdown",
    "public": "dist"
  }
}
```

Without this field, Firebase CLI doesn't know which site to target, and `--only hosting` deploys to all sites.
