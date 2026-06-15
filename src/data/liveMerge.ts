import { LIVE_BILLINGS, LIVE_PRODUCTS, LIVE_META } from "./live";
import type { Account, AMProfile } from "./mock";

export { LIVE_META };

// Overlay live BigQuery billing series + product breakdown (from `npm run
// refresh`) onto the curated account records. Accounts without an AGID match
// (e.g. churned partners no longer billing) keep their static data.
export function withLiveBillings(accounts: Account[]): Account[] {
  return accounts.map(a => {
    const live = a.agid ? LIVE_BILLINGS[a.agid] : undefined;
    const products = a.agid ? LIVE_PRODUCTS[a.agid] : undefined;
    if (!live && !products) return a;
    return {
      ...a,
      ...(live ? { revenueHistory: live.months, mtdBilling: live.mtd ?? undefined } : {}),
      ...(products && products.length ? { productBreakdown: products } : {}),
    };
  });
}

// Recompute the AM-level trend by summing the (live-merged) account series.
// Falls back to the static trend when no account has live data (demo AMs).
export function withLiveTrend(am: AMProfile, accounts: Account[]): AMProfile {
  const hasLive = accounts.some(a => a.agid && LIVE_BILLINGS[a.agid]);
  if (!hasLive) return am;
  const labels = accounts.reduce(
    (best, a) => (a.revenueHistory.length > best.length ? a.revenueHistory.map(h => h.week) : best),
    [] as string[],
  );
  const revenueTrend = labels.map(week => ({
    week,
    mrr: Math.round(accounts.reduce((s, a) => s + (a.revenueHistory.find(h => h.week === week)?.mrr ?? 0), 0)),
  }));
  return { ...am, revenueTrend };
}
