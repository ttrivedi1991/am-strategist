#!/usr/bin/env node
// Refresh live billing data from BigQuery into src/data/live.ts and src/data/billingDocs.ts.
//
// Usage: npm run refresh
// Requires: gcloud SDK authenticated as ttrivedi@vendasta.com
//   (bq binary found via ~/Downloads/google-cloud-sdk/bin or PATH)
//
// Sources:
//   f_billing_partner_snpm  — monthly billings per partner (total_reporting),
//                             including the in-progress month (MTD)
//   f_billing_tx            — invoice + credit note detail per partner
//
// Methodology: total_reporting matches the app's historical series (verified
// May 2026 = $291,075). Invoice amounts use billing_transaction (actual
// invoiced dollars), which can differ from reporting aggregates for FX
// partners like Telkom.

import { execFileSync } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT = "data-warehouse-460017";
const AM_EMAIL = "ttrivedi@vendasta.com";
const SERIES_START = "2025-11-01";

const sdkBq = join(homedir(), "Downloads/google-cloud-sdk/bin/bq");
const BQ = existsSync(sdkBq) ? sdkBq : "bq";

function bq(sql) {
  const out = execFileSync(
    BQ,
    ["query", `--project_id=${PROJECT}`, "--use_legacy_sql=false", "--format=json", "--max_rows=10000", sql],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  const start = out.indexOf("[");
  if (start === -1) throw new Error(`No JSON in bq output:\n${out.slice(0, 500)}`);
  return JSON.parse(out.slice(start));
}

function monthLabel(isoDate) {
  const [y, m] = isoDate.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[m - 1]} ${String(y).slice(2)}`;
}

const today = new Date();
const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
const iso = d => d.toISOString().slice(0, 10);
const currentMonthStart = `${iso(today).slice(0, 7)}-01`;
const lastFullMonthStart = (() => {
  const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
})();

console.log(`Refreshing — current month ${currentMonthStart}, last full month ${lastFullMonthStart}, data through ${iso(yesterday)}`);

// ── 1. Monthly billings per partner (incl. current-month MTD) ───────────────
console.log("Pulling monthly billings from f_billing_partner_snpm…");
const billingRows = bq(`
  SELECT p.vmf_account_group_id AS agid, ANY_VALUE(p.name) AS name,
         CAST(d.date AS STRING) AS month, ROUND(SUM(s.total_reporting), 2) AS total
  FROM \`${PROJECT}.management.f_billing_partner_snpm\` s
  JOIN \`${PROJECT}.management.dim_date\` d ON s.projected_month_date_sk = d.date_sk
  JOIN \`${PROJECT}.management.dim_current_partner\` p ON s.partner_snk = p.partner_snk
  JOIN \`${PROJECT}.management.dim_current_user\` u ON s.assigned_sales_person_snk = u.user_snk
  WHERE u.work_email = '${AM_EMAIL}' AND d.date >= '${SERIES_START}'
  GROUP BY 1, 3`);

// Canonical list of full months from SERIES_START to last full month
// (string arithmetic — Date() parsing is a UTC/local timezone trap)
const fullMonths = [];
{
  let [y, m] = SERIES_START.split("-").map(Number);
  let cur = SERIES_START;
  while (cur < currentMonthStart) {
    fullMonths.push(cur);
    m += 1;
    if (m === 13) { m = 1; y += 1; }
    cur = `${y}-${String(m).padStart(2, "0")}-01`;
  }
}

const partners = {};
for (const r of billingRows) {
  if (!r.agid) continue;
  partners[r.agid] ??= { name: r.name, byMonth: {} };
  partners[r.agid].byMonth[r.month] = Number(r.total);
}

// ── 2. Invoices + credit notes (last full month and current MTD) ────────────
function invoicePull(monthStart, monthEnd) {
  return bq(`
    WITH inv AS (
      SELECT p.vmf_account_group_id AS agid, tx.invoice_identifier_dnk AS invoice_id,
             tx.line_item_sub_type AS sub_type, CAST(MIN(d.date) AS STRING) AS tx_date,
             ROUND(SUM(tx.billing_transaction), 2) AS amount, COUNT(*) AS line_count
      FROM \`${PROJECT}.management.f_billing_tx\` tx
      JOIN \`${PROJECT}.management.dim_date\` d ON tx.transaction_date_sk = d.date_sk
      JOIN \`${PROJECT}.management.dim_current_partner\` p ON tx.partner_snk = p.partner_snk
      JOIN \`${PROJECT}.management.dim_current_user\` u ON tx.assigned_sales_person_snk = u.user_snk
      WHERE u.work_email = '${AM_EMAIL}' AND d.date BETWEEN '${monthStart}' AND '${monthEnd}'
      GROUP BY 1, 2, 3
    ),
    ranked AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY agid ORDER BY ABS(amount) DESC) AS rk FROM inv),
    summary AS (
      SELECT agid,
             COUNT(DISTINCT IF(sub_type != 'Credit', invoice_id, NULL)) AS invoice_count,
             ROUND(SUM(IF(sub_type != 'Credit', amount, 0)), 2) AS billed,
             ROUND(SUM(IF(sub_type = 'Credit', amount, 0)), 2) AS credits
      FROM inv GROUP BY 1
    )
    SELECT r.*, s.invoice_count, s.billed, s.credits
    FROM ranked r JOIN summary s USING (agid)
    WHERE (r.rk <= 5 AND ABS(r.amount) > 0.5) OR r.sub_type = 'Credit'
    ORDER BY agid, rk`);
}

function buildDocs(rows, monthIso, throughDate) {
  const docs = {};
  for (const r of rows) {
    if (!r.agid) continue;
    docs[r.agid] ??= {
      partnerName: partners[r.agid]?.name ?? r.agid,
      month: monthLabel(monthIso).replace(/(\w+) (\d+)/, (_, m, y) => `${m} 20${y}`) + (throughDate ? ` (through ${throughDate})` : ""),
      invoiceCount: Number(r.invoice_count),
      billed: Number(r.billed),
      credits: Number(r.credits),
      topInvoices: [],
      creditNotes: [],
    };
    const entry = { id: r.invoice_id, date: r.tx_date, amount: Number(r.amount), lineCount: Number(r.line_count) };
    (r.sub_type === "Credit" ? docs[r.agid].creditNotes : docs[r.agid].topInvoices).push(entry);
  }
  return docs;
}

const lastFullMonthEnd = iso(new Date(today.getFullYear(), today.getMonth(), 0));
console.log("Pulling invoices + credit notes (last full month)…");
const docsLastMonth = buildDocs(invoicePull(lastFullMonthStart, lastFullMonthEnd), lastFullMonthStart, null);
console.log("Pulling invoices + credit notes (current month MTD)…");
const docsMtd = buildDocs(invoicePull(currentMonthStart, iso(yesterday)), currentMonthStart, iso(yesterday));

// ── 3. Write src/data/live.ts ────────────────────────────────────────────────
const liveEntries = Object.entries(partners).map(([agid, p]) => {
  const months = fullMonths.map(m => `{ week: "${monthLabel(m)}", mrr: ${p.byMonth[m] ?? 0} }`).join(", ");
  const mtdVal = p.byMonth[currentMonthStart];
  const mtd = mtdVal !== undefined ? `{ week: "${monthLabel(currentMonthStart)}", mrr: ${mtdVal} }` : "null";
  return `  "${agid}": { name: ${JSON.stringify(p.name)}, months: [${months}], mtd: ${mtd} },`;
});

writeFileSync(join(ROOT, "src/data/live.ts"), `// GENERATED by scripts/refresh-data.mjs — do not hand-edit.
// Source: BigQuery ${PROJECT}.management.f_billing_partner_snpm (total_reporting),
// filtered to assigned_sales_person = ${AM_EMAIL}.

export interface LiveMonth { week: string; mrr: number; }
export interface LivePartnerBilling { name: string; months: LiveMonth[]; mtd: LiveMonth | null; }

export const LIVE_META = {
  generatedAt: "${iso(today)}",
  dataThrough: "${iso(yesterday)}",
  mtdLabel: "${monthLabel(currentMonthStart)}",
};

export const LIVE_BILLINGS: Record<string, LivePartnerBilling> = {
${liveEntries.join("\n")}
};
`);
console.log(`live.ts written: ${liveEntries.length} partners`);

// ── 4. Write src/data/billingDocs.ts ────────────────────────────────────────
function fmtDocs(docs) {
  return Object.keys(docs).sort().map(agid => {
    const d = docs[agid];
    const fmt = e => `{ id: "${e.id}", date: "${e.date}", amount: ${e.amount.toFixed(2)}, lineCount: ${e.lineCount} }`;
    return `  "${agid}": {
    partnerName: ${JSON.stringify(d.partnerName)},
    month: ${JSON.stringify(d.month)},
    invoiceCount: ${d.invoiceCount},
    billed: ${d.billed.toFixed(2)},
    credits: ${d.credits.toFixed(2)},
    topInvoices: [${d.topInvoices.map(fmt).join(", ")}],
    creditNotes: [${d.creditNotes.map(fmt).join(", ")}],
  },`;
  }).join("\n");
}

writeFileSync(join(ROOT, "src/data/billingDocs.ts"), `// GENERATED by scripts/refresh-data.mjs — do not hand-edit.
// Source: BigQuery ${PROJECT}.management.f_billing_tx,
// filtered to assigned_sales_person = ${AM_EMAIL}. Generated ${iso(today)}.

export interface BillingDoc {
  id: string;        // invoice_identifier_dnk
  date: string;
  amount: number;
  lineCount: number;
}

export interface PartnerBillingDocs {
  partnerName: string;
  month: string;
  invoiceCount: number;
  billed: number;
  credits: number;     // negative when credit notes were issued
  topInvoices: BillingDoc[];  // top 5 by amount
  creditNotes: BillingDoc[];
}

// Last full calendar month
export const BILLING_DOCS: Record<string, PartnerBillingDocs> = {
${fmtDocs(docsLastMonth)}
};

// Current month, through ${iso(yesterday)}
export const BILLING_DOCS_MTD: Record<string, PartnerBillingDocs> = {
${fmtDocs(docsMtd)}
};
`);
console.log(`billingDocs.ts written: ${Object.keys(docsLastMonth).length} partners (last month), ${Object.keys(docsMtd).length} (MTD)`);

const creditCount = Object.values({ ...docsLastMonth, ...docsMtd }).reduce((s, d) => s + d.creditNotes.length, 0);
console.log(`Done. Credit notes found: ${creditCount}. Restart the dev server to see fresh data.`);
