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
import { ensureGeminiModel } from "@/lib/gemini";

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

  const model = await ensureGeminiModel(apiKey);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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

// ─── Per-partner executive summary (Partner Profile) ───────────────────────────

import { quarterDelta, productMovers, trendNarrative } from "@/lib/insights";

export interface PartnerSummary {
  headline: string; // one sentence: where this partnership stands
  body: string;     // 2-4 sentences: what they do, what they run, what moved and why, what's next
}

export function buildPartnerFacts(account: Account, orgAlerts: OrgAlert[]) {
  const q = quarterDelta(account);
  const movers = productMovers(account).slice(0, 4);
  const topLines = [...account.productBreakdown]
    .filter(p => p.mrr > 0).sort((a, b) => b.mrr - a.mrr).slice(0, 4)
    .map(p => `${p.name.trim()} ${exact$(p.mrr)}/mo`);
  return {
    partner: account.name,
    vertical: account.vertical,
    business: account.gtmContext ?? null,
    currentBillings: `${exact$(getLatestMRR(account.revenueHistory))}/mo (${formatMonthLabel(QTR.to)})`,
    quarterMove: q ? `${QTR.label}: ${q.delta < 0 ? "−" : "+"}${exact$(Math.abs(q.delta))}/mo (${exact$(q.from)} → ${exact$(q.to)})` : null,
    productMoves: movers.map(m => `${m.name} ${m.delta < 0 ? "−" : "+"}${exact$(Math.abs(m.delta))}/mo`),
    topProducts: topLines,
    aiProducts: account.products.length > 0 ? account.products : "none live",
    signals: orgAlerts
      .filter(a => a.accountId === account.id)
      .slice(0, 3)
      .map(a => `${a.title} (${a.date})`),
  };
}

export function composePartnerFallback(account: Account, orgAlerts: OrgAlert[]): PartnerSummary {
  const q = quarterDelta(account);
  return {
    headline: q && Math.abs(q.delta) >= 250
      ? `${account.name} ${q.delta < 0 ? "gave back" : "added"} ${exact$(Math.abs(q.delta))}/mo in ${QTR.label}, billing ${exact$(q.to)}/mo at the ${formatMonthLabel(QTR.to)} close.`
      : `${account.name} is billing ${exact$(getLatestMRR(account.revenueHistory))}/mo, steady through ${QTR.label}.`,
    body: `${account.gtmContext ? `${account.gtmContext} ` : ""}${trendNarrative(account, orgAlerts)}`,
  };
}

export async function generatePartnerSummary(
  facts: ReturnType<typeof buildPartnerFacts>,
  apiKey: string,
  signal?: AbortSignal
): Promise<PartnerSummary> {
  const systemPrompt = `You write the executive summary at the top of a partner profile in a Vendasta account manager's dashboard. The reader may be the AM or a VP — one summary serves both.

Rules:
- Use ONLY the facts provided. Copy figures verbatim; never compute, round, or invent numbers or causes.
- Plain, confident business prose. Active voice. No exclamation points, no hype words, no bullet fragments.
- headline: ONE sentence — where this partnership stands and which way it's moving.
- body: 2-4 sentences — what the partner's business is, what they run with Vendasta, what moved recently at the product level, and any live signal worth acting on. If nothing explains a move, say it's being chased, don't speculate.
- Return ONLY valid JSON: {"headline":"…","body":"…"}`;

  const model = await ensureGeminiModel(apiKey);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: `Fact sheet:\n${JSON.stringify(facts, null, 2)}` }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 768 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
  if (!parsed.headline || !parsed.body) throw new Error("Malformed summary");
  return parsed as PartnerSummary;
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
