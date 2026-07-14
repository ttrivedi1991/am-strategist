// Commission math per the Jan 2026 AM Channel Sales plan, shared by
// Dashboard and Commission pages.
//
// METHODOLOGY (verified against finance's Q2-2026 rep-wise payout sheet,
// read 2026-07-14):
//   Each quarter month has a cohort START (≈ prior month close, with small
//   cohort adjustments finance makes for partner reassignments) and an END.
//   Net Quarterly Growth = Σ (month end − month start)   ← telescopes to
//                          ≈ quarter-final close − quarter-first start
//   WAMGR                = Net Quarterly Growth ÷ Σ (month starts)
//   Book growth payout   = tier rate × Σ (month ends) — USD portion × FX
//   Logo retention       = avg of (month-end logos ÷ month-start logos), 3 months
//
// NOT (Q2 total − Q1 total) / Q1 total — the quarter-sum comparison this file
// used before overstated Tanmay's Q2 at +0.52% when finance's actual was −0.24%.
import type { Account } from "@/data/types";
import { getLiveMeta, getAppData } from "@/data/store";
import { SHEET_COMM } from "@/data/sheetComm";
import { LIVE_COMM } from "@/data/live";

// Monthly commissionable for one partner, best source first:
//   1. SHEET_COMM — finance-published actuals (incl. post-close adjustments)
//   2. LIVE_COMM  — warehouse SKU-level (total_reporting × comp-plan
//      inclusion_rate; reconciles to finance closes within 0.2–0.5%)
// Returns undefined when neither source covers the month — callers fall back
// to billings × blended rate.
function knownComm(account: Account, week: string): number | undefined {
  if (!account.agid) return undefined;
  return SHEET_COMM[account.agid]?.[week] ?? LIVE_COMM[account.agid]?.[week];
}

// ── Quarter config — the one place to roll forward each quarter ─────────────
export const QUARTER = {
  label: "Q3 2026",
  months: ["Jul 26", "Aug 26", "Sep 26"],
  monthNames: ["July", "August", "September"],
  baselineWeek: "Jun 26",        // prior-quarter close = Month 1 cohort start
  newSignCutoff: "2026-07-01",   // partners signed on/after are excluded from growth
};

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
// (confirmed by both the Q1 statement and the Q2 payout sheet).
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

// Logo retention bonus (flat quarterly payout, CAD). pct on a 0–100 scale.
export const RETENTION_TIERS = [
  { pct: 95, payout: 900 }, { pct: 96, payout: 1350 }, { pct: 97, payout: 1800 },
  { pct: 98, payout: 2250 }, { pct: 99, payout: 2813 }, { pct: 100, payout: 3375 },
];

// FX applied by finance on the Q2-2026 payout sheet (was 1.38 on the Q1 statement).
export const USD_TO_CAD = 1.4;

export function getRetentionTier(pct: number) {
  let current = { pct: 0, payout: 0 };
  for (const t of RETENTION_TIERS) {
    if (pct >= t.pct) current = t;
    else break;
  }
  return current;
}

export function getNextRetentionTier(pct: number) {
  for (const t of RETENTION_TIERS) if (pct < t.pct) return t;
  return null;
}

export function retentionBonus(pct: number): number {
  return getRetentionTier(pct).payout;
}

// ── Finance-verified prior-quarter finals (Q2-2026 rep-wise payout sheet) ───
// These are the official cohort start/end values finance paid on. Month 1's
// start for the CURRENT quarter is anchored to the prior quarter's final
// month-end so the dashboard always agrees with finance's baseline.
export interface FinalMonth {
  week: string;
  start: number;       // cohort start-of-month commissionable
  end: number;         // cohort end-of-month commissionable
  logosStart: number;
  logosEnd: number;
}
export interface QuarterFinal {
  quarter: string;
  months: FinalMonth[];
  adjustedBook: number;          // Σ month starts — the WAMGR denominator
  bookUnderManagement: number;   // Σ month ends — the payout base
  netQuarterlyGrowth: number;
  wamgr: number;
  rate: number;
  retentionPct: number;
  retentionBonusCAD: number;
  fx: number;
  totalCAD: number;
}

export const PRIOR_QUARTER_FINAL: Record<string, QuarterFinal> = {
  tanmay: {
    quarter: "Q2 2026",
    months: [
      { week: "Apr 26", start: 267297, end: 283079, logosStart: 32, logosEnd: 31 },
      { week: "May 26", start: 283079, end: 246422, logosStart: 32, logosEnd: 32 },
      { week: "Jun 26", start: 246420, end: 265407, logosStart: 33, logosEnd: 33 },
    ],
    adjustedBook: 796795,
    bookUnderManagement: 794909,
    netQuarterlyGrowth: -1886,
    wamgr: -0.0024,
    rate: 0,
    retentionPct: 98.97,
    retentionBonusCAD: 2250,
    fx: 1.4,
    totalCAD: 2250,
  },
  adam: {
    quarter: "Q2 2026",
    months: [
      { week: "Apr 26", start: 192635, end: 177389, logosStart: 35, logosEnd: 35 },
      { week: "May 26", start: 177388, end: 207014, logosStart: 33, logosEnd: 33 },
      { week: "Jun 26", start: 207014, end: 238179, logosStart: 35, logosEnd: 34 },
    ],
    adjustedBook: 577037,
    bookUnderManagement: 622582,
    netQuarterlyGrowth: 45546,
    wamgr: 0.0789,
    rate: 0.03,
    retentionPct: 99.03,
    retentionBonusCAD: 2813,
    fx: 1.4,
    totalCAD: 28961.46,
  },
};

// One-time billing artifacts (loaded from Firestore — they name a partner and
// credit note, so they're confidential and never bundled). NOT applied to
// official monthly numbers — those stay raw, matching finance's pipeline.
export function billingAdjustment(accountName: string, week: string): number {
  return getAppData().billingAdjustments
    .filter(a => a.account === accountName && a.week === week)
    .reduce((s, a) => s + a.amount, 0);
}

export function adjustedBilling(account: Account, week: string): number {
  const raw = account.revenueHistory.find(h => h.week === week)?.mrr ?? 0;
  return raw + billingAdjustment(account.name, week);
}

// Split commissionable for one month into USD and CAD buckets.
// CAD partners (billingCurrency === "CAD") are already in Canadian dollars — no conversion needed.
// USD partners need × USD_TO_CAD at payout time.
export function monthlyCommissionableSplit(
  accounts: Account[],
  week: string,
): { usd: number; cad: number } {
  return accounts.reduce(
    (acc, a) => {
      const known = knownComm(a, week);
      const comm = known !== undefined
        ? known
        : (a.revenueHistory.find(h => h.week === week)?.mrr ?? 0) * blendedRate(a);
      if (a.billingCurrency === "CAD") acc.cad += comm;
      else acc.usd += comm;
      return acc;
    },
    { usd: 0, cad: 0 },
  );
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

// Partners eligible for the current quarter's growth math: billing, and not
// newly signed in-quarter (finance excludes those from the growth cohort).
export function quarterEligiblePartners(accounts: Account[]): Account[] {
  return accounts.filter(a =>
    new Date(a.onboardedDate) < new Date(QUARTER.newSignCutoff) &&
    (a.mrr > 0 ||
      (a.revenueHistory.find(h => h.week === QUARTER.baselineWeek)?.mrr ?? 0) > 0 ||
      (a.mtdBilling?.mrr ?? 0) > 0)
  );
}

// Commissionable dollars for one month. Uses finance actuals, then warehouse
// SKU-level values (see knownComm), then raw billings × blended rate.
export function monthlyCommissionable(accounts: Account[], week: string): number {
  return accounts.reduce((s, a) => {
    const known = knownComm(a, week);
    if (known !== undefined) return s + known;
    return s + (a.revenueHistory.find(h => h.week === week)?.mrr ?? 0) * blendedRate(a) - onboardingComm(a);
  }, 0);
}

// Per-account commissionable for one month (finance actuals, then warehouse
// SKU-level, then revenueHistory billing × blended rate).
export function accountMonthlyCommissionable(account: Account, week: string): number {
  const known = knownComm(account, week);
  if (known !== undefined) return known;
  const billing = account.revenueHistory.find(h => h.week === week)?.mrr ?? 0;
  return billing * blendedRate(account);
}

// Current-month commissionable so far, from the live MTD billings.
export function mtdCommissionable(accounts: Account[]): number {
  return accounts.reduce((s, a) => s + (a.mtdBilling?.mrr ?? 0) * blendedRate(a), 0);
}

// Per-AM in-month pace object (for display: spanDays, priorMonthLabel, etc.).
export function getMtdPace(amId: string) {
  return getLiveMeta().mtdPaceByAm?.[amId];
}

// In-month pace: invoiced dollars this month vs the same day-span last month.
// 1.0 = tracking exactly at last month's level. Per AM.
export function mtdPaceFactor(amId: string): number {
  const p = getMtdPace(amId);
  return p && p.priorSameSpan > 0 ? p.current / p.priorSameSpan : 1;
}

// Returns true when SHEET_COMM actuals cover ≥80% of the commissionable book
// for the given month — i.e. finance has published that month's close.
function isMonthActual(accounts: Account[], week: string): boolean {
  const sheetTotal = accounts.reduce((s, a) => {
    const v = a.agid ? SHEET_COMM[a.agid]?.[week] : undefined;
    return s + (v ?? 0);
  }, 0);
  const total = monthlyCommissionable(accounts, week);
  return total > 0 && sheetTotal / total >= 0.8;
}

// ── Quarter outlook — the finance-sheet model ────────────────────────────────

export interface QuarterMonth {
  week: string;   // "Jul 26"
  name: string;   // "July"
  start: number;  // cohort start (chained from prior month's end)
  end: number;    // close (actual) or projection
  diff: number;
  // final: finance-published · closed: month over, warehouse numbers ·
  // inProgress: projected at in-month pace · assumed: future month held flat
  status: "final" | "closed" | "inProgress" | "assumed";
}

export interface TierTarget {
  wamgr: number;
  rate: number;
  label: string;
  netGrowthNeeded: number;      // NQG dollars needed to reach this tier
  quarterCloseNeeded: number;   // final-month close needed (growth telescopes)
  gapFromProjection: number;    // vs projected NQG; ≤0 means already on track
  estPayoutCAD: number;         // rate × current projected book (approximate)
}

export interface QuarterOutlook {
  quarter: string;
  months: QuarterMonth[];
  // Month 1 start anchored to finance's verified prior-quarter close when we
  // have it; delta = warehouse baseline sum − finance close (data drift).
  baselineIsFinal: boolean;
  baselineWarehouseDelta: number;
  adjustedBook: number;           // Σ month starts — WAMGR denominator
  bookUnderManagement: number;    // Σ month ends — payout base
  netQuarterlyGrowth: number;     // Σ month diffs ≈ final close − Month 1 start
  wamgr: number;
  tier: ReturnType<typeof getCommissionTier>;
  nextTier: ReturnType<typeof getNextCommissionTier>;
  bookUSD: number;
  bookCAD: number;
  bookGrowthCommissionCAD: number;   // tier rate × (bookUSD × FX + bookCAD)
  cohortSize: number;                // logos at Month 1 start
  retentionPct: number;              // 0–100; assumes no further cancellations
  retentionBonusCAD: number;
  retentionOneLossPct: number;       // sensitivity: one cancellation this quarter
  retentionOneLossBonusCAD: number;
  projectedCommissionCAD: number;
  gapToNextTier: number;             // additional net growth $ to reach next tier
  nextTierUpliftCAD: number;         // payout delta if next tier is reached
  tierTargets: TierTarget[];
  paceFactor: number;
}

export function computeQuarterOutlook(accounts: Account[], amId: string): QuarterOutlook {
  const eligible = quarterEligiblePartners(accounts);
  const paceFactor = mtdPaceFactor(amId);
  const mtdLabel = getLiveMeta().mtdLabel;
  const currentIdx = QUARTER.months.indexOf(mtdLabel); // -1 once the quarter is fully closed

  // Month 1 cohort start = prior-quarter close. Prefer finance's verified
  // number (the payout sheet) over the warehouse sum — June's warehouse data
  // carries one-time invoice items finance excludes from the growth basis.
  const final = PRIOR_QUARTER_FINAL[amId];
  const warehouseBaseline = monthlyCommissionable(eligible, QUARTER.baselineWeek);
  const financeBaseline = final?.months[final.months.length - 1]?.end;
  const m1Start = financeBaseline ?? warehouseBaseline;
  const baselineIsFinal = financeBaseline !== undefined;
  const baselineWarehouseDelta = warehouseBaseline - m1Start;

  const months: QuarterMonth[] = [];
  let prevEnd = m1Start;
  QUARTER.months.forEach((week, i) => {
    const start = prevEnd;
    let end: number;
    let status: QuarterMonth["status"];
    if (isMonthActual(eligible, week)) {
      end = monthlyCommissionable(eligible, week);
      status = "final";
    } else if (currentIdx !== -1 && i < currentIdx) {
      end = monthlyCommissionable(eligible, week);
      status = "closed";
    } else if (i === currentIdx) {
      end = start * paceFactor;
      status = "inProgress";
    } else {
      end = start; // hold flat — no signal yet for future months
      status = "assumed";
    }
    months.push({ week, name: QUARTER.monthNames[i], start, end, diff: end - start, status });
    prevEnd = end;
  });

  const adjustedBook = months.reduce((s, m) => s + m.start, 0);
  const bookUnderManagement = months.reduce((s, m) => s + m.end, 0);
  const netQuarterlyGrowth = months.reduce((s, m) => s + m.diff, 0);
  const wamgr = adjustedBook > 0 ? netQuarterlyGrowth / adjustedBook : 0;

  const tier = getCommissionTier(wamgr);
  const nextTier = getNextCommissionTier(wamgr);

  // Currency split: real split for finance-published months; projected months
  // inherit the baseline month's CAD share (Cantrex + Home.CA bill in CAD).
  const baseSplit = monthlyCommissionableSplit(eligible, QUARTER.baselineWeek);
  const baseCadShare = baseSplit.usd + baseSplit.cad > 0
    ? baseSplit.cad / (baseSplit.usd + baseSplit.cad) : 0;
  let bookUSD = 0, bookCAD = 0;
  for (const m of months) {
    if (m.status === "final" || m.status === "closed") {
      const split = monthlyCommissionableSplit(eligible, m.week);
      bookUSD += split.usd;
      bookCAD += split.cad;
    } else {
      bookCAD += m.end * baseCadShare;
      bookUSD += m.end * (1 - baseCadShare);
    }
  }
  const bookGrowthCommissionCAD = tier.rate * (bookUSD * USD_TO_CAD + bookCAD);

  // Logo retention: month-end logos ÷ month-start logos, averaged. Months
  // without a published close assume no cancellations; the one-loss line shows
  // what a single cancellation does to the bonus.
  const countActive = (week: string) =>
    eligible.filter(a => (a.revenueHistory.find(h => h.week === week)?.mrr ?? 0) > 0).length;
  const cohortSize = countActive(QUARTER.baselineWeek);
  let retentionSum = 0;
  let prevCount = cohortSize;
  for (const m of months) {
    if ((m.status === "final" || m.status === "closed") && prevCount > 0) {
      const endCount = countActive(m.week);
      retentionSum += Math.min(endCount / prevCount, 1);
      prevCount = endCount;
    } else {
      retentionSum += 1; // assume no cancellations in unpublished months
    }
  }
  const retentionPct = (retentionSum / months.length) * 100;
  const retentionBonusCAD = retentionBonus(retentionPct);
  const retentionOneLossPct = cohortSize > 0
    ? ((retentionSum - 1 + (cohortSize - 1) / cohortSize) / months.length) * 100
    : retentionPct;
  const retentionOneLossBonusCAD = retentionBonus(retentionOneLossPct);

  // Tier targets: net growth needed for each tier, and the quarter close that
  // implies (growth telescopes to final close − Month 1 start, before finance's
  // small cohort adjustments).
  const tierTargets: TierTarget[] = COMMISSION_TIERS.map(t => {
    const netGrowthNeeded = t.wamgr * adjustedBook;
    return {
      ...t,
      netGrowthNeeded,
      quarterCloseNeeded: m1Start + netGrowthNeeded,
      gapFromProjection: netGrowthNeeded - netQuarterlyGrowth,
      estPayoutCAD: t.rate * (bookUSD * USD_TO_CAD + bookCAD),
    };
  });

  const gapToNextTier = nextTier
    ? Math.max(0, nextTier.wamgr * adjustedBook - netQuarterlyGrowth)
    : 0;
  const nextTierUpliftCAD = nextTier
    ? (nextTier.rate - tier.rate) * (bookUSD * USD_TO_CAD + bookCAD)
    : 0;

  return {
    quarter: QUARTER.label,
    months,
    baselineIsFinal, baselineWarehouseDelta,
    adjustedBook, bookUnderManagement, netQuarterlyGrowth, wamgr,
    tier, nextTier,
    bookUSD, bookCAD, bookGrowthCommissionCAD,
    cohortSize, retentionPct, retentionBonusCAD,
    retentionOneLossPct, retentionOneLossBonusCAD,
    projectedCommissionCAD: bookGrowthCommissionCAD + retentionBonusCAD,
    gapToNextTier, nextTierUpliftCAD,
    tierTargets, paceFactor,
  };
}
