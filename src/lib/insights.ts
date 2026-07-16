// Shared derivations that turn per-account micro-data into narrative:
// quarter deltas, trend stories, and themed recommended actions.
// Born from Bryan Larson's Jul 16 feedback — headings should name the
// business shift, numbers should come with a why.
import type { Account, OrgAlert } from "@/data/types";
import { getLatestMRR, recentDeltaMRR, formatMonthLabel, formatDate, daysSince } from "@/lib/utils";

export function exact$(v: number): string {
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

// Last completed quarter's movement (Mar 2026 close → Jun 2026 close).
// Label-based lookup so it survives history-length changes; roll the labels
// forward when the quarter closes.
export const QTR = { label: "Q2", from: "Mar 26", to: "Jun 26" };

export function quarterDelta(account: Account): { delta: number; from: number; to: number } | null {
  const from = account.revenueHistory.find(h => h.week === QTR.from)?.mrr;
  const to = account.revenueHistory.find(h => h.week === QTR.to)?.mrr;
  if (from == null || to == null) return null;
  return { delta: to - from, from, to };
}

// Last 6 closed months, for trend charts and "current vs past track".
export function sixMonthHistory(account: Account) {
  return account.revenueHistory.slice(-6);
}

// One-line explanation of the recent movement, built from what we can
// actually attribute: the size/direction of the move, the dominant product
// line, and any live org signal. Honest about what we don't know.
export function trendNarrative(account: Account, alerts: OrgAlert[]): string {
  const recent = recentDeltaMRR(account.revenueHistory);
  const latest = getLatestMRR(account.revenueHistory);
  const topLine = [...account.productBreakdown].filter(p => p.mrr > 0).sort((a, b) => b.mrr - a.mrr)[0];
  const signal = alerts
    .filter(a => a.accountId === account.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  const parts: string[] = [];
  if (recent && Math.abs(recent.delta) >= 250) {
    parts.push(
      recent.delta < 0
        ? `Billings stepped down ${exact$(Math.abs(recent.delta))} over the last 60 days (${formatMonthLabel(recent.fromLabel)} ${exact$(recent.from)} → ${formatMonthLabel(recent.toLabel)} ${exact$(recent.to)}).`
        : `Billings grew ${exact$(recent.delta)} over the last 60 days (${formatMonthLabel(recent.fromLabel)} ${exact$(recent.from)} → ${formatMonthLabel(recent.toLabel)} ${exact$(recent.to)}).`
    );
  } else {
    parts.push(`Billings are steady at ${exact$(latest)}/mo.`);
  }
  if (topLine) {
    const share = latest > 0 ? Math.round((topLine.mrr / latest) * 100) : 0;
    parts.push(`${topLine.name.trim()} carries the account (${exact$(topLine.mrr)}/mo${share > 0 && share <= 100 ? `, ~${share}% of billings` : ""}).`);
  }
  if (signal && daysSince(signal.date) <= 90) {
    parts.push(`Context: ${signal.title} (${formatDate(signal.date)}).`);
  }
  return parts.join(" ");
}

// ─── Recommended actions ───────────────────────────────────────────────────────
// Theme = the business shift, per Bryan: the heading names WHAT is happening;
// the partner and specifics follow.

export interface RecommendedAction {
  theme: string;          // "Q2 Expansion — Confirm", "Ownership Change", …
  account: Account;
  detail: string;         // partner-specific why, with numbers
  urgency: "high" | "medium" | "low";
  score: number;
  alertId?: string;
}

const ALERT_THEME: Record<OrgAlert["type"], string> = {
  acquisition: "Ownership Change",
  leadership: "Leadership Change",
  "gtm-change": "GTM Shift",
  funding: "Strategic Signal",
  expansion: "Expansion Signal",
  award: "Momentum Moment",
};

export function recommendedActions(
  accounts: Account[],
  orgAlerts: OrgAlert[],
  limit = 5
): RecommendedAction[] {
  const candidates: RecommendedAction[] = [];

  for (const account of accounts) {
    const latest = getLatestMRR(account.revenueHistory);
    if (latest <= 0) continue;
    const recent = recentDeltaMRR(account.revenueHistory);
    const q = quarterDelta(account);

    // Live org signal (fresh, high/medium)
    const signal = orgAlerts
      .filter(a => a.accountId === account.id && a.urgency !== "low" && daysSince(a.date) <= 60)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    if (signal) {
      candidates.push({
        theme: ALERT_THEME[signal.type],
        account,
        detail: `${signal.title}. ${signal.actionSuggestion}`,
        urgency: signal.urgency as "high" | "medium",
        score: (signal.urgency === "high" ? 3000 : 1500) + latest / 10,
        alertId: signal.id,
      });
    }

    // Revenue recovery — meaningful 60-day step-down
    if (recent && recent.delta < -500) {
      candidates.push({
        theme: "Revenue Recovery",
        account,
        detail: `Billings ${exact$(recent.from)} (${formatMonthLabel(recent.fromLabel)}) → ${exact$(recent.to)} (${formatMonthLabel(recent.toLabel)}). Find out whether this is deliberate or fixable before more volume walks.`,
        urgency: recent.delta < -2000 ? "high" : "medium",
        score: 2000 + Math.abs(recent.delta),
        });
    }

    // Q2 expansion to confirm — grew last quarter, lock in what drove it
    if (q && q.delta > 500 && (recent?.delta ?? 0) >= 0) {
      candidates.push({
        theme: "Q2 Expansion — Confirm",
        account,
        detail: `Grew ${exact$(q.delta)}/mo across Q2 (${exact$(q.from)} → ${exact$(q.to)}). Confirm what drove it and build the second-half expansion on top.`,
        urgency: "medium",
        score: 1000 + q.delta,
      });
    }

    // AI adoption gap on a real account
    if (account.products.length === 0 && latest > 3000) {
      candidates.push({
        theme: "AI Adoption Gap",
        account,
        detail: `${exact$(latest)}/mo in billings with zero AI products live. Highest-leverage expansion conversation on the book.`,
        urgency: "medium",
        score: 800 + latest / 5,
      });
    }
  }

  // Best action per account, then top N overall
  const byAccount = new Map<string, RecommendedAction>();
  for (const c of candidates) {
    const cur = byAccount.get(c.account.id);
    if (!cur || c.score > cur.score) byAccount.set(c.account.id, c);
  }
  return [...byAccount.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

// ─── Book-level story ──────────────────────────────────────────────────────────

export function bookStory(accounts: Account[], orgAlerts: OrgAlert[]): string {
  const active = accounts.filter(a => getLatestMRR(a.revenueHistory) > 0);
  const totalNow = active.reduce((s, a) => s + getLatestMRR(a.revenueHistory), 0);
  const totalQFrom = active.reduce((s, a) => s + (a.revenueHistory.find(h => h.week === QTR.from)?.mrr ?? 0), 0);
  const qd = totalNow - totalQFrom;

  const movers = active
    .map(a => ({ a, d: recentDeltaMRR(a.revenueHistory)?.delta ?? 0 }))
    .sort((x, y) => x.d - y.d);
  const decliner = movers[0];
  const gainer = movers[movers.length - 1];
  const urgent = orgAlerts.filter(al => al.urgency === "high").length;

  const dir = qd >= 0 ? `up ${exact$(qd)}` : `down ${exact$(Math.abs(qd))}`;
  const parts = [
    `The book closed ${QTR.label} at ${exact$(totalNow)}/mo, ${dir} vs the ${formatMonthLabel(QTR.from)} close.`,
  ];
  if (gainer && gainer.d > 500) parts.push(`${gainer.a.name} is the biggest recent gainer (+${exact$(gainer.d)}/mo over 60 days).`);
  if (decliner && decliner.d < -500) parts.push(`${decliner.a.name} is the biggest recent decline (−${exact$(Math.abs(decliner.d))}/mo).`);
  if (urgent > 0) parts.push(`${urgent} partner${urgent > 1 ? "s have" : " has"} a high-urgency signal in play.`);
  return parts.join(" ");
}
