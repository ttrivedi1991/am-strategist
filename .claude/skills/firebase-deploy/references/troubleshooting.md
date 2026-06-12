# Firebase Deploy Troubleshooting

## Common deployment errors

### "HTTP Error: 404, Requested entity was not found"
**Cause**: The hosting site name in `firebase.json` doesn't match any site in the Firebase project.
**Fix**: Verify the site exists: `firebase hosting:sites:list --project PROJECT_ID`. Create it if missing: `firebase hosting:sites:create SITE_NAME --project PROJECT_ID`.

### "HTTP Error: 403, The caller does not have permission"
**Cause**: Your Firebase account doesn't have deploy permissions for this project.
**Fix**: Ask a project owner to grant you the Firebase Hosting Admin role, or run `firebase login` to switch to an authorized account.

### "Error: No deploy targets are specified"
**Cause**: `firebase.json` is empty or malformed.
**Fix**: Run `/firebase-init` to regenerate configuration, or manually add a `hosting` section.

### "Error: Cloud Functions deployment requires the pay-as-you-go (Blaze) billing plan"
**Cause**: Functions deploy needs Blaze plan.
**Fix**: Upgrade the project billing plan in the Firebase console, or deploy only hosting: `--only hosting:SITE`.

### Build failures before deploy

#### "npm run build" fails
- Check `package.json` for the correct build script name
- Ensure dependencies are installed: `npm install`
- Check for TypeScript errors: `npx tsc --noEmit`
- Check environment variables are set (`.env` files)

#### Build output is in wrong directory
- `firebase.json` `public` field must match your build output directory
- Common values: `dist`, `build`, `public`, `out`
- Vite default: `dist`
- Create React App default: `build`
- Next.js export: `out`

### Deploy succeeds but site shows wrong content

#### You see another project's content
**Cause**: You deployed without `--only hosting:SITE` on a multi-site project, overwriting all sites.
**Fix**: Each affected site owner must redeploy their app. To prevent this, always use `/firebase-deploy` which enforces site scoping.

#### You see old content
**Cause**: Stale build artifacts were deployed.
**Fix**: Run your build command, then deploy again. Check that `firebase.json` `public` points to the right directory.

#### You see "Site Not Found"
**Cause**: The hosting site doesn't exist yet.
**Fix**: Create it: `firebase hosting:sites:create SITE_NAME --project PROJECT_ID`

### "Error: Failed to get Firebase project"
**Cause**: The project ID in `.firebaserc` is wrong.
**Fix**: Check available projects with `firebase projects:list` and update `.firebaserc`.

### Firestore rules deploy fails with "database not found"
**Cause**: The named database in `firebase.json` `firestore.database` doesn't exist.
**Fix**: Create it: `gcloud firestore databases create --database=DB_NAME --location=northamerica-northeast1 --project=PROJECT_ID`

### Firestore rules deployed to wrong database
**Cause**: `firestore.database` is missing from `firebase.json`, so rules deployed to `(default)`.
**Fix**: Add `"database": "your-db-name"` to the `firestore` section. Use the same name as your hosting site. Then redeploy the correct rules to `(default)` if needed.

### "The database does not exist or the caller does not have permission"
**Cause**: Either the named database hasn't been created yet, or your account lacks permissions.
**Fix**: Check if database exists: `gcloud firestore databases list --project=PROJECT_ID`. Create if missing, or request Datastore/Firestore Admin permissions.

## Preview channels (for safer testing)

Deploy to a temporary preview URL instead of production:
```bash
firebase hosting:channel:deploy preview --project PROJECT_ID --only hosting:SITE
```

This creates a temporary URL (expires in 7 days by default) where you can test before deploying to production.

## Rolling back a bad deploy

Firebase keeps the last few deployments. To roll back:
1. Go to Firebase Console → Hosting
2. Find the previous deployment in the release history
3. Click "Rollback" on the version you want to restore

Or use the CLI:
```bash
firebase hosting:clone PROJECT_ID:SITE@VERSION PROJECT_ID:SITE --project PROJECT_ID
```
