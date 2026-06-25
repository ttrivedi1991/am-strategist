#!/usr/bin/env -S npx tsx
// Seed the named "am-strategist" Firestore database from the seed-only data
// modules. Run with: npx tsx scripts/seed-firestore.ts
// Auth: gcloud Application Default Credentials (ttrivedi@vendasta.com).
//
// This is what keeps confidential data OUT of the public bundle — the app reads
// these documents at runtime (gated by Firebase Auth + the email allowlist in
// firestore.rules), instead of importing the data at build time.
import { Firestore } from "@google-cloud/firestore";
import { ACCOUNTS, AM_ROSTER, ORG_ALERTS, AI_ADOPTION_DATA, BILLING_ADJUSTMENTS } from "../src/data/mock";
import { withLiveBillings, LIVE_META } from "../src/data/liveMerge";
import { BILLING_DOCS, BILLING_DOCS_MTD } from "../src/data/billingDocs";

const PROJECT = "vendasta-citizen-developers";
const DATABASE = "am-strategist";

const db = new Firestore({ projectId: PROJECT, databaseId: DATABASE });

// Firestore rejects `undefined` field values; round-trip drops them.
const clean = <T>(o: T): T => JSON.parse(JSON.stringify(o));

async function seedCollection(name: string, items: any[], idKey: string) {
  // Clear stale docs first so removed accounts/alerts don't linger.
  const existing = await db.collection(name).listDocuments();
  let batch = db.batch();
  let ops = 0;
  for (const ref of existing) { batch.delete(ref); if (++ops === 450) { await batch.commit(); batch = db.batch(); ops = 0; } }
  for (const item of items) {
    batch.set(db.collection(name).doc(String(item[idKey])), clean(item));
    if (++ops === 450) { await batch.commit(); batch = db.batch(); ops = 0; }
  }
  if (ops) await batch.commit();
  console.log(`  ${name}: ${items.length} docs`);
}

async function main() {
  console.log(`Seeding ${DATABASE} on ${PROJECT}…`);

  // Merge live billing into accounts at seed time (was a runtime overlay).
  const mergedAccounts = withLiveBillings(ACCOUNTS);
  await seedCollection("accounts", mergedAccounts, "id");
  await seedCollection("roster", AM_ROSTER, "id");
  await seedCollection("orgAlerts", ORG_ALERTS, "id");

  await db.collection("meta").doc("live").set(clean(LIVE_META));
  await db.collection("meta").doc("aiAdoption").set({ data: clean(AI_ADOPTION_DATA) });
  await db.collection("meta").doc("billingDocs").set({ byAgid: clean(BILLING_DOCS) });
  await db.collection("meta").doc("billingDocsMtd").set({ byAgid: clean(BILLING_DOCS_MTD) });
  await db.collection("meta").doc("billingAdjustments").set({ items: clean(BILLING_ADJUSTMENTS) });
  console.log("  meta: live, aiAdoption, billingDocs, billingDocsMtd, billingAdjustments");

  // Gemini API key — read from env at seed time, never committed to git.
  // Pass via: GEMINI_API_KEY=AIza... npx tsx scripts/seed-firestore.ts
  const geminiApiKey = process.env.GEMINI_API_KEY ?? null;
  if (geminiApiKey) {
    await db.collection("meta").doc("config").set({ geminiApiKey });
    console.log("  meta/config: geminiApiKey set");
  } else {
    console.log("  meta/config: GEMINI_API_KEY not set — skipping (existing value preserved)");
  }

  console.log("Done.");
}

main().catch(e => { console.error(e); process.exit(1); });
