// Commission math per the Jan 2026 AM Channel Sales plan, shared by
// Dashboard and Commission pages. Rates and tiers verified against the
// official plan PDF and the Q1-2026 commission statement (Jun 11, 2026).
import type { Account } from "@/data/types";
import { getLiveMeta, getAppData } from "@/data/store";

export const COMMISSION_TIERS = [
  { wamgr: 0.0000, rate: 0.0060, label: "0.00%" },
  { wamgr: 0.0025, rate: 0.0090, label: "0.25%" },
  { wamgr: 0.0050, rate: 0.0120, label: "0.50%" },
  { wamgr: 0.0100, rate: 0.0150, label: "1.00%" },
  { wamgr: 0.0200, rate: 0.0188, label: "2.00%" },
  { wamgr: 0.0300, rate: 0.0225, label: "3.00%" },
  { wamgr: 0.0500, rate: 0.0300, label: "5.00%" },
];

// Negative growth pays 0% — only WAMGR >= 0.00% reaches the first tier
// (confirmed by the Q1-2026 statement: -0.12% growth → 0.00% rate → $0).
export const NEGATIVE_TIER = { wamgr: -1, rate: 0, label: "negative" };

export function getCommissionTier(wamgr: number) {
  if (wamgr < 0) return NEGATIVE_TIER;
  let current = COMMISSION_TIERS[0];
  for (const tier of COMMISSION_TIERS) {
    if (wamgr >= tier.wamgr) current = tier;
    else break;
  }
  return current;
}

export function getNextCommissionTier(wamgr: number) {
  if (wamgr < 0) return COMMISSION_TIERS[0]; // from negative, the next milestone is 0.00% (pays 0.60%)
  for (let i = 0; i < COMMISSION_TIERS.length - 1; i++) {
    if (wamgr < COMMISSION_TIERS[i + 1].wamgr) return COMMISSION_TIERS[i + 1];
  }
  return null;
}

// Logo retention bonus (flat quarterly payout, CAD)
export const RETENTION_TIERS = [
  { pct: 95, payout: 900 }, { pct: 96, payout: 1350 }, { pct: 97, payout: 1800 },
  { pct: 98, payout: 2250 }, { pct: 99, payout: 2813 }, { pct: 100, payout: 3375 },
];
export const Q1_RETENTION = 97.09; // from the Q1-2026 commission statement
export const USD_TO_CAD = 1.38;    // FX on the Q1-2026 statement

export function retentionBonus(pct: number): number {
  let payout = 0;
  for (const t of RETENTION_TIERS) if (pct >= t.pct) payout = t.payout;
  return payout;
}

// One-time billing artifacts (loaded from Firestore — they name a partner and
// credit note, so they're confidential and never bundled). NOT applied to
// official monthly numbers — those stay raw, matching the HOS dashboard and
// finance's pipeline (credits count in the month they land; any payout
// adjustment is finance's discretion). Because Net Quarterly Growth telescopes
// to (Jun close − Mar close), an intra-quarter overcharge and its reversing
// credit cancel out of Q2 WAMGR on their own; the only place the artifact
// distorts is a projection anchored on the affected month — so these are used
// solely to build a clean base for the in-progress-month estimate.
export function billingAdjustment(accountName: string, week: string): number {
  return getAppData().billingAdjustments
    .filter(a => a.account === accountName && a.week === week)
    .reduce((s, a) => s + a.amount, 0);
}

export function adjustedBilling(account: Account, week: string): number {
  const raw = account.revenueHistory.find(h => h.week === week)?.mrr ?? 0;
  return raw + billingAdjustment(account.name, week);
}

// Blended commissionable rate from the product mix (billings × inclusion rate).
export function blendedRate(account: Account): number {
  const bill = account.productBreakdown.reduce((s, p) => s + (p.mrr > 0 ? p.mrr : 0), 0);
  const comm = account.productBreakdown.reduce((s, p) => s + (p.mrr > 0 ? p.commissionable : 0), 0);
  return bill > 0 ? comm / bill : 0.95;
}

function onboardingComm(account: Account): number {
  return account.productBreakdown
    .filter(p => p.category === "Onboarding")
    .reduce((s, p) => s + p.commissionable, 0);
}

// Partners eligible for Q2 growth math: billing, and not newly signed in-quarter.
export function q2EligiblePartners(accounts: Account[]): Account[] {
  return accounts.filter(a => a.mrr > 0 && new Date(a.onboardedDate) < new Date("2026-04-01"));
}

// Commissionable dollars for one month: raw (official) billings × blended rate,
// excluding Onboarding (per plan). Matches the warehouse — credits included.
export function monthlyCommissionable(accounts: Account[], week: string): number {
  return accounts.reduce(
    (s, a) => s + (a.revenueHistory.find(h => h.week === week)?.mrr ?? 0) * blendedRate(a) - onboardingComm(a),
    0
  );
}

// Same, with one-time credits reversed — used ONLY as the June projection anchor.
function monthlyCommissionableCreditFree(accounts: Account[], week: string): number {
  return accounts.reduce(
    (s, a) => s + adjustedBilling(a, week) * blendedRate(a) - onboardingComm(a),
    0
  );
}

// Current-month commissionable so far, from the live MTD billings.
export function mtdCommissionable(accounts: Account[]): number {
  return accounts.reduce((s, a) => s + (a.mtdBilling?.mrr ?? 0) * blendedRate(a), 0);
}

// In-month pace: invoiced dollars this month vs the same day-span last month.
// 1.0 = tracking exactly at last month's level.
export function mtdPaceFactor(): number {
  const p = getLiveMeta().mtdPace;
  return p && p.priorSameSpan > 0 ? p.current / p.priorSameSpan : 1;
}

export interface Q2Outlook {
  marComm: number; aprComm: number; mayComm: number; junCommEst: number;
  wamgrToDate: number;     // Apr + May actuals only
  wamgrProjected: number;  // June estimated at the current in-month pace
  tier: ReturnType<typeof getCommissionTier>;
  nextTier: ReturnType<typeof getNextCommissionTier>;
  bookUnderManagement: number;             // Apr + May + Jun est
  bookGrowthCommissionCAD: number;         // tier rate × book, in CAD
  retentionBonusCAD: number;               // estimated at Q1's retention
  projectedCommissionCAD: number;
  gapToNextTier: number;                   // commissionable $ needed this quarter
  paceFactor: number;
}

export function computeQ2Outlook(accounts: Account[]): Q2Outlook {
  const eligible = q2EligiblePartners(accounts);
  const marComm = monthlyCommissionable(eligible, "Mar 26");
  const aprComm = monthlyCommissionable(eligible, "Apr 26");
  const mayComm = monthlyCommissionable(eligible, "May 26");
  const paceFactor = mtdPaceFactor();
  // June anchored on May with the one-time Telkom credit reversed — projecting
  // from the credit-depressed raw May would understate June (the HOS dashboard
  // projects June above May for the same reason).
  const junCommEst = monthlyCommissionableCreditFree(eligible, "May 26") * paceFactor;

  const wamgrToDate = marComm + aprComm > 0 ? (mayComm - marComm) / (marComm + aprComm) : 0;
  const projBase = marComm + aprComm + mayComm;
  const wamgrProjected = projBase > 0 ? (junCommEst - marComm) / projBase : 0;

  const tier = getCommissionTier(wamgrProjected);
  const nextTier = getNextCommissionTier(wamgrProjected);
  const bookUnderManagement = aprComm + mayComm + junCommEst;
  const bookGrowthCommissionCAD = tier.rate * bookUnderManagement * USD_TO_CAD;
  const retentionBonusCAD = retentionBonus(Q1_RETENTION);

  const projNetGrowth = junCommEst - marComm;
  const gapToNextTier = nextTier ? Math.max(0, nextTier.wamgr * projBase - projNetGrowth) : 0;

  return {
    marComm, aprComm, mayComm, junCommEst,
    wamgrToDate, wamgrProjected, tier, nextTier,
    bookUnderManagement, bookGrowthCommissionCAD, retentionBonusCAD,
    projectedCommissionCAD: bookGrowthCommissionCAD + retentionBonusCAD,
    gapToNextTier, paceFactor,
  };
}
