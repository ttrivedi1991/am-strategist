// Executive summary of the book — one consistent narrative for every reader
// (AM, Head of Sales, VP, CEO). Gemini writes it from a strict fact sheet so
// the prose is real prose; the facts are computed here so the numbers are
// exact. Falls back to a deterministic summary when no Gemini key is set.
import type { Account, OrgAlert, MtdPace } from "@/data/types";
import { getLatestMRR, formatMonthLabel } from "@/lib/utils";
import {
  bookBridge, recommendedActions, exact$, QTR,
  type RecommendedAction, type BridgeDriver,
} from "@/lib/insights";

export interface ExecSummary {
  headline: string;      // one sentence: position + trajectory
  performance: string;   // what happened and why, 2-3 sentences
  risks: string;         // 1-2 sentences
  outlook: string;       // pace + what's in motion, 1-2 sentences
}

export interface BookFacts {
  quarter: string;
  activePartners: number;
  closeFrom: string;   // "Mar 2026: $322,410/mo"
  closeTo: string;
  netMove: string;     // "−$8,120/mo (−2.5%)"
  concentration: string;
  decliners: string[]; // "UWM −$12,000/mo — reason: … | current $41,400/mo"
  gainers: string[];
  mtdPace: string | null;
  highSignals: string[];
  actionsInMotion: string[];
}

export function buildBookFacts(
  accounts: Account[],
  orgAlerts: OrgAlert[],
  pace: MtdPace | undefined,
  mtdLabel: string,
  mtdTotal: number
): BookFacts {
  const bridge = bookBridge(accounts, orgAlerts);
  const actions = recommendedActions(accounts, orgAlerts, 5);
  const pct = bridge.from > 0 ? ((bridge.delta / bridge.from) * 100).toFixed(1) : "0";

  const driverLine = (d: BridgeDriver) =>
    `${d.account.name} ${d.delta < 0 ? "−" : "+"}${exact$(Math.abs(d.delta))}/mo — ${d.reason ?? "no verified cause yet; being asked directly"}`;

  const pacePct = pace && pace.priorSameSpan > 0
    ? ((pace.current / pace.priorSameSpan - 1) * 100)
    : null;

  return {
    quarter: QTR.label,
    activePartners: accounts.filter(a => getLatestMRR(a.revenueHistory) > 0).length,
    closeFrom: `${formatMonthLabel(QTR.from)}: ${exact$(bridge.from)}/mo`,
    closeTo: `${formatMonthLabel(QTR.to)}: ${exact$(bridge.to)}/mo`,
    netMove: `${bridge.delta < 0 ? "−" : "+"}${exact$(Math.abs(bridge.delta))}/mo (${bridge.delta < 0 ? "" : "+"}${pct}%)`,
    concentration: `top movers explain ~${bridge.coveredPct}% of gross movement`,
    decliners: bridge.decliners.slice(0, 4).map(driverLine),
    gainers: bridge.gainers.slice(0, 4).map(driverLine),
    mtdPace: mtdTotal > 0
      ? `${formatMonthLabel(mtdLabel)} MTD ${exact$(mtdTotal)}${pacePct != null ? `, pacing ${pacePct >= 0 ? "+" : ""}${pacePct.toFixed(1)}% vs same span of ${formatMonthLabel(pace!.priorMonthLabel)}` : ""}`
      : null,
    highSignals: orgAlerts.filter(a => a.urgency === "high").map(a => `${a.accountName}: ${a.title}`),
    actionsInMotion: actions.map((a: RecommendedAction) => `${a.theme} — ${a.account.name}`),
  };
}

// Deterministic fallback — used when Gemini is unavailable. Written as prose,
// not concatenated clauses.
export function composeFallback(f: BookFacts): ExecSummary {
  const down = f.netMove.startsWith("−");
  return {
    headline: `The book ${down ? "gave back" : "added"} ${f.netMove.replace(/^[−+]/, "")} in ${f.quarter}, closing at ${f.closeTo.split(": ")[1]} across ${f.activePartners} active partners.`,
    performance: `${down ? "The decline" : "The growth"} is concentrated — ${f.concentration}. ${f.decliners.length > 0 ? `Largest declines: ${f.decliners.slice(0, 2).join("; ")}.` : ""} ${f.gainers.length > 0 ? `Largest gains: ${f.gainers.slice(0, 2).join("; ")}.` : ""}`.trim(),
    risks: f.highSignals.length > 0
      ? `${f.highSignals.length} partner${f.highSignals.length > 1 ? "s carry" : " carries"} a high-urgency signal: ${f.highSignals.slice(0, 2).join("; ")}.`
      : "No high-urgency signals in play.",
    outlook: `${f.mtdPace ? `${f.mtdPace}. ` : ""}In motion: ${f.actionsInMotion.slice(0, 3).join("; ")}.`,
  };
}

export async function generateExecSummary(
  facts: BookFacts,
  apiKey: string,
  signal?: AbortSignal
): Promise<ExecSummary> {
  const systemPrompt = `You write the executive summary that sits at the top of a Vendasta account manager's book-of-business dashboard. Readers range from the AM to the CEO — one summary serves all of them.

Rules:
- Use ONLY the facts and numbers provided. Copy figures verbatim; never compute, round, or invent numbers or causes.
- Where a driver has "no verified cause yet", say the movement is unexplained and being chased — do not speculate.
- Plain, confident business prose. Active voice. No exclamation points, no hype words, no bullet fragments.
- headline: ONE sentence — the position and trajectory of the book.
- performance: 2-3 sentences — what moved and why, naming the partners that drive it.
- risks: 1-2 sentences — what could get worse and where.
- outlook: 1-2 sentences — current-month pace and the plays in motion.
- Return ONLY valid JSON: {"headline":"…","performance":"…","risks":"…","outlook":"…"}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: `Fact sheet:\n${JSON.stringify(facts, null, 2)}` }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 1024 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
  if (!parsed.headline || !parsed.performance) throw new Error("Malformed summary");
  return parsed as ExecSummary;
}

// Cache per data-refresh so every visit doesn't re-generate. Keyed by AM +
// data-through date; a new BigQuery refresh naturally invalidates it.
export function summaryCacheKey(amId: string, dataThrough: string) {
  return `execSummary:${amId}:${dataThrough}`;
}

export function loadCachedSummary(key: string): ExecSummary | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ExecSummary) : null;
  } catch {
    return null;
  }
}

export function cacheSummary(key: string, s: ExecSummary) {
  localStorage.setItem(key, JSON.stringify(s));
}
