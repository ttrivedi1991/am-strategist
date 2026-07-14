import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAM } from "@/context/AMContext";
import { formatCurrency, formatMonthLabel } from "@/lib/utils";
import {
  COMMISSION_TIERS, USD_TO_CAD, blendedRate,
  computeQ2Outlook, monthlyCommissionable, mtdCommissionable, q2EligiblePartners,
  accountMonthlyCommissionable,
} from "@/lib/commission";

import { useNavigate } from "react-router-dom";
import {
  TrendingUp, TrendingDown, Users, ArrowRight,
  Flame, DollarSign, Target, AlertTriangle, BrainCircuit,
  ChevronDown, ChevronUp, Package,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";

// ── Month filter options ─────────────────────────────────────────────────────

const FILTER_MONTHS = [
  { label: "Jan", week: "Jan 26", q: "Q1 '26" },
  { label: "Feb", week: "Feb 26", q: "Q1 '26" },
  { label: "Mar", week: "Mar 26", q: "Q1 '26" },
  { label: "Apr", week: "Apr 26", q: "Q2 '26" },
  { label: "May", week: "May 26", q: "Q2 '26" },
  { label: "Jun", week: "Jun 26", q: "Q2 '26" },
] as const;

type FilterWeek = typeof FILTER_MONTHS[number]["week"];

// ── Commission plan constants (Jan 2026) ────────────────────────────────────

const RETENTION_TIERS = [
  { pct: 0.950, bonus: 900 },
  { pct: 0.960, bonus: 1350 },
  { pct: 0.970, bonus: 1800 },
  { pct: 0.980, bonus: 2250 },
  { pct: 0.990, bonus: 2813 },
  { pct: 1.000, bonus: 3375 },
];

function getRetentionTier(pct: number) {
  let current = { pct: 0, bonus: 0 };
  for (const tier of RETENTION_TIERS) {
    if (pct >= tier.pct) current = tier;
    else break;
  }
  return current;
}

function getNextRetentionTier(pct: number) {
  for (const tier of RETENTION_TIERS) {
    if (pct < tier.pct) return tier;
  }
  return null;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Commission() {
  const navigate = useNavigate();
  const am = useAM();
  const [tab, setTab] = useState<"overview" | "sku">("overview");
  const [focusMonth, setFocusMonth] = useState<FilterWeek>("Jun 26");
  const { accounts, selectedAM } = am;
  // Non-null: pages render only after AMContext finishes loading (ProtectedRoute gate).
  const LIVE_META = am.liveMeta!;
  const pace = LIVE_META.mtdPaceByAm[selectedAM.id]; // per-AM pace for display

  // Shared commission math (src/lib/commission.ts): official raw billings,
  // June projected from a credit-free May base at the current in-month pace.
  const outlook = computeQ2Outlook(accounts, selectedAM.id);
  const {
    janComm, febComm, marComm, aprComm, mayComm, junCommEst, junIsActual,
    q1Sum, q2Sum,
    wamgrToDate, wamgrProjected, tier: currentTier, nextTier,
    bookUnderManagement, bookUSD, bookCAD,
    bookGrowthCommissionCAD, paceFactor, gapToNextTier,
  } = outlook;
  const aprGrowth = aprComm - marComm;
  const mayGrowth = mayComm - aprComm;
  const partialNetGrowth = aprGrowth + mayGrowth;
  // When June is actual use the true QoQ net growth (Q2 − Q1); before that
  // we can only confirm the Apr+May vs Mar partial view.
  const netQuarterlyGrowth = junIsActual ? q2Sum - q1Sum : partialNetGrowth;
  const wamgr = wamgrProjected; // tier + payout follow the projected quarter

  const additionalCommNeededForNextTier = gapToNextTier;
  // Next-tier uplift in CAD: rate delta × CAD-converted book
  const additionalCommissionAtNextTier = nextTier
    ? (nextTier.rate - currentTier.rate) * (bookUSD * USD_TO_CAD + bookCAD)
    : 0;

  // In-month standing (live, through last business day)
  const mtdComm = mtdCommissionable(accounts);
  const mtdBillings = accounts.reduce((s, a) => s + (a.mtdBilling?.mrr ?? 0), 0);
  const pacePct = (paceFactor - 1) * 100;

  // ── Logo Retention ──────────────────────────────────────────────────────────
  // Rule: cohort = partners with billing > $0 in a given month, assigned to Tanmay.
  // Cancelled = billing goes to $0. Average monthly retention across Q2 (Apr, May, Jun est).
  // History indices: Mar=4, Apr=5, May=6

  function countRetained(prevWeek: string, currWeek: string) {
    return accounts.filter(a =>
      (a.revenueHistory.find(h => h.week === prevWeek)?.mrr ?? 0) > 0 &&
      (a.revenueHistory.find(h => h.week === currWeek)?.mrr ?? 0) > 0
    ).length;
  }

  function countCohort(week: string) {
    return accounts.filter(a => (a.revenueHistory.find(h => h.week === week)?.mrr ?? 0) > 0).length;
  }

  const marCohort = countCohort("Mar 26");
  const aprCohort = countCohort("Apr 26");

  const aprRetainedCount = countRetained("Mar 26", "Apr 26");
  const mayRetainedCount = countRetained("Apr 26", "May 26");

  const aprRetention = marCohort > 0 ? aprRetainedCount / marCohort : 1;
  const mayRetention = aprCohort > 0 ? mayRetainedCount / aprCohort : 1;
  const junRetentionEst = 1.0; // estimated: no further cancellations in June

  const logoRetentionPct = (aprRetention + mayRetention + junRetentionEst) / 3;
  const retentionTier = getRetentionTier(logoRetentionPct);
  const nextRetentionTier = getNextRetentionTier(logoRetentionPct);

  // Partners who actually cancelled in Q2 — billing went to $0 during Apr or May
  const cancelledInQ2 = accounts.filter(a => {
    const marMrr = a.revenueHistory.find(h => h.week === "Mar 26")?.mrr ?? 0;
    const aprMrr = a.revenueHistory.find(h => h.week === "Apr 26")?.mrr ?? 0;
    const mayMrr = a.revenueHistory.find(h => h.week === "May 26")?.mrr ?? 0;
    return (marMrr > 0 && aprMrr === 0) || (aprMrr > 0 && mayMrr === 0);
  });

  // ── Total commission in CAD ──────────────────────────────────────────────────
  // bookGrowthCommissionCAD already applies USD_TO_CAD to USD partners and
  // leaves CAD partners unconverted. Retention bonus is a flat CAD amount.
  const totalPayoutCAD = bookGrowthCommissionCAD + retentionTier.bonus;

  // ── Chart data ──────────────────────────────────────────────────────────────
  const chartData = [
    { month: "Jan '26", week: "Jan 26", comm: janComm, isBaseline: true },
    { month: "Feb '26", week: "Feb 26", comm: febComm, isBaseline: true },
    { month: "Mar '26", week: "Mar 26", comm: marComm, isBaseline: true },
    { month: "Apr '26", week: "Apr 26", comm: aprComm, isBaseline: false },
    { month: "May '26", week: "May 26", comm: mayComm, isBaseline: false },
    { month: junIsActual ? "Jun '26" : "Jun '26 (proj)", week: "Jun 26", comm: junCommEst, isEstimate: !junIsActual },
  ];

  // ── Strategy Engine ─────────────────────────────────────────────────────────
  type Strategy = {
    account: string;
    action: string;
    impact: number;
    type: "save" | "ai" | "expand";
    urgency: "high" | "medium";
    accountId: string;
  };

  const strategies: Strategy[] = [];

  // 1. Save churning accounts (churn = lose those commissionable dollars from book)
  accounts.filter(a => a.health === "churning" && a.mrr > 0).forEach(acc => {
    const comm = acc.productBreakdown.reduce((s, p) => s + (p.mrr > 0 ? p.commissionable : 0), 0);
    strategies.push({
      account: acc.name,
      action: `${formatCurrency(comm)} commissionable at risk — saving prevents book decline`,
      impact: comm * currentTier.rate * 3,
      type: "save",
      urgency: "high",
      accountId: acc.id,
    });
  });

  // 2. Expand AI into no-AI accounts (95% inclusion rate = high commissionable ratio)
  accounts
    .filter(a => a.aiAdoption === "none" && a.mrr > 0 && a.health !== "churning")
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, 4)
    .forEach(acc => {
      const estimatedAIComm = Math.round(acc.mrr * 0.015); // ~1.5% of MRR as conservative AI product estimate
      strategies.push({
        account: acc.name,
        action: `No AI products — est. ${formatCurrency(estimatedAIComm)}/mo new commissionable at 95% inclusion`,
        impact: estimatedAIComm * currentTier.rate * 3,
        type: "ai",
        urgency: "medium",
        accountId: acc.id,
      });
    });

  // 3. Reverse declining at-risk accounts
  accounts.filter(a => a.health === "at-risk" && a.mrr < a.mrrPrev).forEach(acc => {
    const rate = blendedRate(acc);
    const commDecline = (acc.mrrPrev - acc.mrr) * rate;
    strategies.push({
      account: acc.name,
      action: `Billing declining ${formatCurrency(acc.mrrPrev - acc.mrr)}/mo — reversal adds ${formatCurrency(commDecline)} commissionable`,
      impact: commDecline * currentTier.rate * 2,
      type: "expand",
      urgency: "medium",
      accountId: acc.id,
    });
  });

  strategies.sort((a, b) => b.impact - a.impact);
  const topStrategies = strategies.slice(0, 6);

  const strategyTypeConfig = {
    save: { label: "Churn Risk", icon: AlertTriangle, color: "text-v-red", bg: "bg-v-red/10" },
    ai: { label: "AI Expansion", icon: BrainCircuit, color: "text-v-blue", bg: "bg-v-blue/10" },
    expand: { label: "Decline Risk", icon: TrendingDown, color: "text-v-amber", bg: "bg-v-amber/10" },
  };

  return (
    <div className="animate-fade-in">
      <Header
        title="Commission Analytics"
        subtitle={junIsActual
          ? `Q2 2026 · Commission: ${formatCurrency(totalPayoutCAD)} CAD · WAMGR ${(wamgrProjected * 100).toFixed(2)}% QoQ (${currentTier.label} tier → ${(currentTier.rate * 100).toFixed(2)}% of book) · Q2: ${formatCurrency(q2Sum)} vs Q1: ${formatCurrency(q1Sum)}`
          : `Q2 2026 · Projected: ${formatCurrency(totalPayoutCAD)} CAD · WAMGR ${(wamgrToDate * 100).toFixed(2)}% to date, ${(wamgrProjected * 100).toFixed(2)}% projected (${currentTier.label} tier) · Q2 book: ${formatCurrency(bookUnderManagement)}`
        }
      />

      {/* Tab strip */}
      <div className="px-6 pt-4 flex gap-1 border-b border-border">
        {([["overview", "Overview"], ["sku", "By SKU"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              tab === id
                ? "border-primary text-primary bg-background"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Month filter strip — shared across both tabs */}
      <div className="px-6 py-3 flex items-center gap-4 flex-wrap border-b border-border bg-secondary/20">
        <span className="text-xs font-medium text-muted-foreground shrink-0">Focus month:</span>
        {(["Q1 '26", "Q2 '26"] as const).map(q => {
          const months = FILTER_MONTHS.filter(m => m.q === q);
          return (
            <div key={q} className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">{q}</span>
              <div className="flex gap-1">
                {months.map(m => (
                  <button
                    key={m.week}
                    onClick={() => setFocusMonth(m.week)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                      focusMonth === m.week
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <span className="text-[10px] text-muted-foreground ml-auto hidden sm:block">
          {focusMonth} · commissionable {formatCurrency(monthlyCommissionable(q2EligiblePartners(accounts), focusMonth))}
        </span>
      </div>

      {tab === "overview" && <div className="p-6 space-y-6">
        {/* ── In-month standing (live) ── */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-v-blue/5 border border-v-blue/20">
          <DollarSign className="w-4 h-4 text-v-blue mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {formatMonthLabel(LIVE_META.mtdLabel)} so far: {formatCurrency(mtdComm)} commissionable ({formatCurrency(mtdBillings)} billings) through {LIVE_META.dataThrough}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pacing {pacePct >= 0 ? "+" : ""}{pacePct.toFixed(1)}%{pace ? ` vs the same ${pace.spanDays} days of ${formatMonthLabel(pace.priorMonthLabel)}` : ""} (invoiced $, credits excluded) ·
              {junIsActual
                ? <>June actual (finance-approved): <span className="font-medium text-foreground">{formatCurrency(junCommEst)}</span> commissionable</>
                : <>June projected at this pace: <span className="font-medium text-foreground">{formatCurrency(junCommEst)}</span> commissionable</>
              }
            </p>
          </div>
        </div>

        {/* ── Summary row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-v-teal/30 bg-v-teal/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-v-teal" />
                <p className="text-xs font-medium text-muted-foreground">{junIsActual ? "Q2 Commission" : "Projected Commission"}</p>
              </div>
              <p className="text-2xl font-bold text-v-teal">{formatCurrency(totalPayoutCAD)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Book growth + retention bonus · CAD</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">WAMGR</p>
              </div>
              <p className={`text-2xl font-bold ${wamgr >= 0.01 ? "text-v-green" : wamgr >= 0 ? "text-v-amber" : "text-v-red"}`}>
                {(wamgrProjected * 100).toFixed(2)}%
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {junIsActual
                  ? `Q2 ${formatCurrency(q2Sum)} vs Q1 ${formatCurrency(q1Sum)}`
                  : `To date: ${(wamgrToDate * 100).toFixed(2)}% (Apr+May vs Jan+Feb)`
                } · {wamgrProjected < 0 ? "negative growth → 0% payout" : `${currentTier.label} tier → ${(currentTier.rate * 100).toFixed(2)}% of book`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">Logo Retention</p>
              </div>
              <p className={`text-2xl font-bold ${logoRetentionPct >= 0.98 ? "text-v-green" : logoRetentionPct >= 0.95 ? "text-v-amber" : "text-v-red"}`}>
                {(logoRetentionPct * 100).toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">{cancelledInQ2.length === 0 ? "No cancellations" : `${cancelledInQ2.length} cancelled`} in Q2 · {formatCurrency(retentionTier.bonus)} bonus</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">Net Quarterly Growth</p>
              </div>
              <p className={`text-2xl font-bold ${netQuarterlyGrowth >= 0 ? "text-v-green" : "text-v-red"}`}>
                {netQuarterlyGrowth >= 0 ? "+" : ""}{formatCurrency(netQuarterlyGrowth)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Commissionable · {junIsActual ? "Q2 total vs Q1 total" : "Apr + May vs Mar"}</p>
            </CardContent>
          </Card>
        </div>

        {/* ── QoQ Chart + Commission Breakdown ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Chart + table */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Commissionable Billings — Q2 2026</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Existing partners only · Onboarding excluded · WAMGR = (Q2 total − Q1 total) / Q1 total · {junIsActual ? "Jun actual (finance-approved)" : `Jun projected from credit-free May at ${(paceFactor * 100).toFixed(0)}% pace`}
                  </p>
                </div>
                <Badge variant={wamgr >= 0.01 ? "success" : wamgr >= 0 ? "warning" : "danger"}>
                  WAMGR {(wamgr * 100).toFixed(2)}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    formatter={(v: any) => [formatCurrency(v as number), "Commissionable"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                  />
                  <Bar dataKey="comm" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => {
                      const isFocus = entry.week === focusMonth;
                      return (
                        <Cell
                          key={i}
                          fill={isFocus ? "#6366f1" : (entry as any).isEstimate ? "#d1d5db" : entry.isBaseline ? "#d1fae5" : "#00B67A"}
                          opacity={isFocus ? 1 : 0.75}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Monthly breakdown table */}
              <div className="mt-4 rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/60 text-muted-foreground">
                      <th className="text-left px-3 py-2 font-medium">Month</th>
                      <th className="text-right px-3 py-2 font-medium">Commissionable</th>
                      <th className="text-right px-3 py-2 font-medium">MoM Growth</th>
                      <th className="text-right px-3 py-2 font-medium">MoM %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr className={`bg-secondary/20 text-muted-foreground ${focusMonth === "Mar 26" ? "ring-1 ring-inset ring-indigo-400/40 bg-indigo-50/30" : ""}`}>
                      <td className="px-3 py-2">Mar 2026 (Q2 baseline){focusMonth === "Mar 26" && <span className="ml-1.5 text-[10px] text-indigo-500 font-semibold">◀ focus</span>}</td>
                      <td className="text-right px-3 py-2 font-medium">{formatCurrency(marComm)}</td>
                      <td className="text-right px-3 py-2">—</td>
                      <td className="text-right px-3 py-2">—</td>
                    </tr>
                    {[
                      { label: "Apr 2026", week: "Apr 26", comm: aprComm, growth: aprGrowth, prev: marComm },
                      { label: "May 2026", week: "May 26", comm: mayComm, growth: mayGrowth, prev: aprComm },
                      { label: junIsActual ? "Jun 2026 (actual)" : "Jun 2026 (proj. at pace)", week: "Jun 26", comm: junCommEst, growth: junCommEst - mayComm, prev: mayComm, isEst: !junIsActual },
                    ].map(row => {
                      const isFocus = focusMonth === row.week;
                      return (
                      <tr key={row.label} className={`${(row as any).isEst ? "opacity-50 italic" : ""} ${isFocus ? "bg-indigo-50/40 font-semibold" : ""}`}>
                        <td className="px-3 py-2 font-medium">
                          {row.label}
                          {isFocus && <span className="ml-1.5 text-[10px] text-indigo-500 font-semibold">◀ focus</span>}
                        </td>
                        <td className="text-right px-3 py-2 font-medium">{formatCurrency(row.comm)}</td>
                        <td className={`text-right px-3 py-2 font-semibold ${row.growth >= 0 ? "text-v-green" : "text-v-red"}`}>
                          {row.growth >= 0 ? "+" : ""}{formatCurrency(row.growth)}
                        </td>
                        <td className={`text-right px-3 py-2 ${row.growth >= 0 ? "text-v-green" : "text-v-red"}`}>
                          {row.prev > 0 ? `${row.growth >= 0 ? "+" : ""}${((row.growth / row.prev) * 100).toFixed(2)}%` : "—"}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-secondary/50 font-semibold border-t-2 border-border">
                      <td className="px-3 py-2">Q2 WAMGR {junIsActual ? "(Jun actual)" : "(Jun projected)"}</td>
                      <td className="text-right px-3 py-2">
                        {formatCurrency(bookUnderManagement)}
                        {junIsActual && <span className="text-[10px] font-normal text-muted-foreground ml-1">vs Q1 {formatCurrency(q1Sum)}</span>}
                      </td>
                      <td className={`text-right px-3 py-2 ${netQuarterlyGrowth >= 0 ? "text-v-green" : "text-v-red"}`}>
                        {netQuarterlyGrowth >= 0 ? "+" : ""}{formatCurrency(netQuarterlyGrowth)}
                      </td>
                      <td className={`text-right px-3 py-2 ${wamgrProjected >= 0 ? "text-v-green" : "text-v-red"}`}>
                        WAMGR {(wamgrProjected * 100).toFixed(2)}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Right column: Commission Breakdown + Logo Retention */}
          <div className="space-y-4">
            {/* Commission breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Commission Breakdown</CardTitle>
                <p className="text-xs text-muted-foreground">Q2 2026 payout · all amounts in CAD</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* WAMGR tier ladder */}
                <div className="space-y-1">
                  {COMMISSION_TIERS.map((tier, i) => {
                    const isActive = tier.wamgr === currentTier.wamgr;
                    const isNext = nextTier?.wamgr === tier.wamgr;
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-between text-xs px-2 py-1.5 rounded transition-colors ${
                          isActive ? "bg-v-teal/10 border border-v-teal/30"
                          : isNext ? "bg-v-amber/5 border border-v-amber/20"
                          : "border border-transparent"
                        }`}
                      >
                        <span className={isActive ? "text-v-teal font-semibold" : isNext ? "text-v-amber" : "text-muted-foreground"}>
                          {isActive ? "▶ " : ""}{tier.label} WAMGR
                        </span>
                        <span className={isActive ? "font-bold text-v-teal" : isNext ? "text-v-amber" : "text-muted-foreground"}>
                          {(tier.rate * 100).toFixed(2)}% of book
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Payout math — all output values in CAD */}
                <div className="border-t border-border pt-3 space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Book (Apr – Jun commissionable)</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">USD partners</span>
                    <span className="font-medium">{formatCurrency(bookUSD)} USD</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">CAD partners (Cantrex, Home.CA)</span>
                    <span className="font-medium">{formatCurrency(bookCAD)} CAD</span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-border pt-1.5 mt-1">
                    <span className="text-muted-foreground">Commission rate</span>
                    <span className="font-medium">{(currentTier.rate * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">USD → CAD rate</span>
                    <span className="font-medium">× {USD_TO_CAD.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold border-t border-border pt-1.5 mt-1">
                    <span className="text-muted-foreground">USD: {formatCurrency(bookUSD)} × {(currentTier.rate * 100).toFixed(2)}% × {USD_TO_CAD.toFixed(2)}</span>
                    <span className="text-v-teal">{formatCurrency(bookUSD * currentTier.rate * USD_TO_CAD)} CAD</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">CAD: {formatCurrency(bookCAD)} × {(currentTier.rate * 100).toFixed(2)}%</span>
                    <span className="text-v-teal">{formatCurrency(bookCAD * currentTier.rate)} CAD</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold border-t border-border pt-1.5">
                    <span>Book Growth Commission</span>
                    <span className="text-v-teal">{formatCurrency(bookGrowthCommissionCAD)} CAD</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Logo Retention Bonus</span>
                    <span className="text-v-blue">{formatCurrency(retentionTier.bonus)} CAD</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t-2 border-border pt-2 mt-1">
                    <span>{junIsActual ? "Total Q2 Commission" : "Total Projected Q2"}</span>
                    <span className="text-v-teal">{formatCurrency(totalPayoutCAD)} CAD</span>
                  </div>
                </div>

                {/* Next tier nudge */}
                {nextTier && (
                  <div className="p-2.5 rounded-lg bg-v-amber/5 border border-v-amber/20 space-y-0.5">
                    <p className="text-[10px] font-semibold text-v-amber">
                      Next tier: {nextTier.label} WAMGR → {(nextTier.rate * 100).toFixed(2)}% payout
                    </p>
                    <p className="text-[10px] text-foreground">
                      Grow commissionable by {formatCurrency(additionalCommNeededForNextTier)} to unlock +{formatCurrency(additionalCommissionAtNextTier)} more commission
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Logo retention card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-v-blue" /> Logo Retention
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-2xl font-bold ${logoRetentionPct >= 0.98 ? "text-v-green" : logoRetentionPct >= 0.95 ? "text-v-amber" : "text-v-red"}`}>
                    {(logoRetentionPct * 100).toFixed(1)}%
                  </span>
                  <Badge variant={logoRetentionPct >= 0.98 ? "success" : logoRetentionPct >= 0.95 ? "warning" : "danger"}>
                    {formatCurrency(retentionTier.bonus)} bonus
                  </Badge>
                </div>

                <div className="w-full bg-secondary rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${logoRetentionPct >= 0.98 ? "bg-v-green" : logoRetentionPct >= 0.95 ? "bg-v-amber" : "bg-v-red"}`}
                    style={{ width: `${Math.min(logoRetentionPct * 100, 100)}%` }}
                  />
                </div>

                <div className="space-y-1">
                  {RETENTION_TIERS.map((tier, i) => {
                    const isActive = retentionTier.pct === tier.pct;
                    const isNext = nextRetentionTier?.pct === tier.pct;
                    return (
                      <div key={i} className={`flex justify-between text-xs px-2 py-0.5 rounded ${isActive ? "bg-v-blue/10 text-v-blue font-semibold" : isNext ? "text-v-amber" : "text-muted-foreground"}`}>
                        <span>{isActive ? "▶ " : ""}{(tier.pct * 100).toFixed(0)}%</span>
                        <span>{formatCurrency(tier.bonus)}</span>
                      </div>
                    );
                  })}
                </div>

                {cancelledInQ2.length > 0 ? (
                  <div className="p-2 rounded-lg bg-v-red/5 border border-v-red/20">
                    <p className="text-[10px] font-semibold text-v-red mb-0.5">
                      {cancelledInQ2.length} partner{cancelledInQ2.length !== 1 ? "s" : ""} cancelled in Q2 (billing → $0)
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      {cancelledInQ2.map(a => a.name).join(" · ")}
                    </p>
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-v-teal/5 border border-v-teal/20">
                    <p className="text-[10px] font-semibold text-v-teal">No partner cancellations in Q2 so far</p>
                  </div>
                )}

                <div className="p-2 rounded-lg bg-secondary/50 border border-border space-y-0.5">
                  <p className="text-[10px] font-semibold text-muted-foreground">Monthly breakdown</p>
                  <p className="text-[10px] text-muted-foreground">Apr: {(aprRetention * 100).toFixed(1)}% · May: {(mayRetention * 100).toFixed(1)}% · Jun: {(junRetentionEst * 100).toFixed(0)}% est.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Strategy Engine ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-v-amber" />
                Commission Growth Strategies
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">Ranked by Q2 commission impact</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Actions that move your WAMGR or protect your retention bonus — sorted by estimated commission impact
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {topStrategies.map((s, i) => {
              const cfg = strategyTypeConfig[s.type];
              const Icon = cfg.icon;
              return (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${cfg.bg}`}>
                      <Icon className={`w-3 h-3 ${cfg.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">{s.account}</span>
                        <Badge
                          variant={s.urgency === "high" ? "danger" : "warning"}
                          className="text-[10px]"
                        >
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.action}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-bold text-v-teal">+{formatCurrency(s.impact)}</p>
                      <p className="text-[10px] text-muted-foreground">est. commission</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/outreach?account=${s.accountId}`)}
                    >
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {topStrategies.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No open strategies — book is in great shape.</p>
            )}
          </CardContent>
        </Card>
      </div>}

      {tab === "sku" && <SkuBreakdown accounts={accounts} focusMonth={focusMonth} onOutreach={id => navigate(`/outreach?account=${id}`)} />}
    </div>
  );
}

// ── By SKU tab ────────────────────────────────────────────────────────────────

function SkuBreakdown({
  accounts,
  focusMonth,
  onOutreach,
}: {
  accounts: import("@/data/types").Account[];
  focusMonth: FilterWeek;
  onOutreach: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  // ── Single month-aware base ─────────────────────────────────────────────────
  // For each account: compute actual monthly billing + commissionable, then
  // scale each product's snapshot values proportionally. This makes BOTH tables
  // respond to the month filter. The inclusion rate per product is stable (it
  // comes from the commission plan, not billing volume), so the scale factor
  // is applied uniformly across all products for that account.
  const monthlyBase = accounts.map(a => {
    const monthBilling = a.revenueHistory.find(h => h.week === focusMonth)?.mrr ?? 0;
    const monthComm   = accountMonthlyCommissionable(a, focusMonth);
    const snapBilling = a.productBreakdown.reduce((s, p) => s + (p.mrr > 0 ? p.mrr : 0), 0);
    const snapComm    = a.productBreakdown.reduce((s, p) => s + (p.mrr > 0 ? p.commissionable : 0), 0);
    const bScale = snapBilling > 0 ? monthBilling / snapBilling : 0;
    const cScale = snapComm    > 0 ? monthComm   / snapComm    : 0;
    return { account: a, monthBilling, monthComm, bScale, cScale };
  }).filter(r => r.monthComm > 0 || r.monthBilling > 0);

  // ── By Account rows ─────────────────────────────────────────────────────────
  const accountRows = monthlyBase
    .map(({ account, monthBilling, monthComm, bScale, cScale }) => ({
      id: account.id,
      name: account.name,
      totalBilling: monthBilling,
      totalComm: monthComm,
      // Per-SKU: scale snapshot billing/commissionable by the monthly factor so
      // rows sum to the correct monthly total shown in the account header.
      skus: account.productBreakdown
        .filter(p => p.mrr > 0 || (p.quantity ?? 0) > 0)
        .map(p => ({
          ...p,
          mrr: p.mrr * bScale,
          commissionable: p.commissionable * cScale,
        }))
        .sort((x, y) => y.commissionable - x.commissionable),
    }))
    .sort((a, b) => b.totalComm - a.totalComm);

  // ── Product rollup ──────────────────────────────────────────────────────────
  const productMap = new Map<string, { category: string; billing: number; commissionable: number; acctIds: Set<string> }>();
  monthlyBase.forEach(({ account, bScale, cScale }) => {
    account.productBreakdown.filter(p => p.mrr > 0).forEach(p => {
      if (!productMap.has(p.name)) {
        productMap.set(p.name, { category: p.category, billing: 0, commissionable: 0, acctIds: new Set() });
      }
      const e = productMap.get(p.name)!;
      e.billing       += p.mrr          * bScale;
      e.commissionable += p.commissionable * cScale;
      e.acctIds.add(account.id);
    });
  });
  const productRollup = [...productMap.entries()]
    .map(([name, d]) => ({
      name,
      category: d.category,
      billing: d.billing,
      commissionable: d.commissionable,
      accountCount: d.acctIds.size,
      inclRate: d.billing > 0 ? d.commissionable / d.billing : 0,
    }))
    .sort((a, b) => b.commissionable - a.commissionable);

  const totalBilling = productRollup.reduce((s, p) => s + p.billing, 0);
  const totalComm    = productRollup.reduce((s, p) => s + p.commissionable, 0);

  return (
    <div className="p-6 space-y-6">

      {/* ── By account ── shown first — responds directly to month filter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            By Account — {focusMonth}
          </h2>
          <span className="text-xs text-muted-foreground">
            {accountRows.length} partners · sorted by commissionable $
          </span>
        </div>

        {accountRows.map(a => {
          const isOpen = expanded === a.id;
          return (
            <Card key={a.id}>
              <CardContent className="p-0">
                <button
                  onClick={() => setExpanded(isOpen ? null : a.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/30 transition-colors group"
                >
                  <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                    <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Billings</p>
                        <p className="text-xs font-medium tnum">{formatCurrency(a.totalBilling)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Commissionable</p>
                        <p className="text-xs font-bold text-v-teal tnum">{formatCurrency(a.totalComm)}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{a.skus.length} SKU{a.skus.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 px-2"
                      onClick={e => { e.stopPropagation(); onOutreach(a.id); }}
                    >
                      Outreach <ArrowRight className="w-3 h-3" />
                    </Button>
                    {isOpen
                      ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                      : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border">
                    <div className="flex items-center px-4 py-1.5 bg-secondary/40 text-[10px] font-semibold text-muted-foreground">
                      <div className="flex-1">Product</div>
                      <div className="w-28 text-right">Billings</div>
                      <div className="w-32 text-right">Commissionable</div>
                      <div className="w-16 text-right hidden md:block">Incl. Rate</div>
                    </div>
                    <div className="divide-y divide-border">
                      {a.skus.map(p => {
                        const inclRate = p.mrr > 0 ? Math.round(p.commissionable / p.mrr * 100) : 0;
                        return (
                          <div key={p.name} className="flex items-center px-4 py-2 text-xs">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{p.name}</p>
                              {p.category && <p className="text-[10px] text-muted-foreground">{p.category}</p>}
                            </div>
                            <div className="w-28 text-right font-semibold tnum">{formatCurrency(p.mrr)}</div>
                            <div className="w-32 text-right font-semibold text-v-teal tnum">{formatCurrency(p.commissionable)}</div>
                            <div className="w-16 text-right hidden md:block">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                p.mrr === 0 ? "bg-secondary text-muted-foreground"
                                : inclRate >= 90 ? "bg-v-teal/10 text-v-teal"
                                : inclRate >= 40 ? "bg-v-amber/10 text-v-amber"
                                : "bg-v-red/10 text-v-red"
                              }`}>
                                {p.mrr > 0 ? `${inclRate}%` : "free"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center px-4 py-2 border-t border-border bg-secondary/30 text-xs font-semibold">
                      <div className="flex-1">Total</div>
                      <div className="w-28 text-right tnum">{formatCurrency(a.totalBilling)}</div>
                      <div className="w-32 text-right text-v-teal tnum">{formatCurrency(a.totalComm)}</div>
                      <div className="w-16 hidden md:block"></div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Product rollup ── scaled to focusMonth */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-v-blue" />
            By Product — {focusMonth}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Each product's billing and commissionable scaled to {focusMonth} using each account's monthly totals · sorted by commissionable desc
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-secondary/60 text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-2.5 font-medium">Product</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Category</th>
                  <th className="text-right px-4 py-2.5 font-medium">Partners</th>
                  <th className="text-right px-4 py-2.5 font-medium">Billings</th>
                  <th className="text-right px-4 py-2.5 font-medium text-v-teal">Commissionable</th>
                  <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">Incl. Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {productRollup.map(p => {
                  const pct = Math.round(p.inclRate * 100);
                  return (
                    <tr key={p.name} className="hover:bg-secondary/30">
                      <td className="px-4 py-2.5 font-medium text-foreground">{p.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{p.category}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{p.accountCount}</td>
                      <td className="px-4 py-2.5 text-right font-medium tnum">{formatCurrency(p.billing)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-v-teal tnum">{formatCurrency(p.commissionable)}</td>
                      <td className="px-4 py-2.5 text-right hidden md:table-cell">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          p.billing === 0 ? "bg-secondary text-muted-foreground"
                          : pct >= 90 ? "bg-v-teal/10 text-v-teal"
                          : pct >= 40 ? "bg-v-amber/10 text-v-amber"
                          : "bg-v-red/10 text-v-red"
                        }`}>
                          {p.billing > 0 ? `${pct}%` : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-secondary/50 border-t-2 border-border font-semibold text-xs">
                  <td className="px-4 py-2.5" colSpan={2}>Total ({productRollup.length} SKUs)</td>
                  <td className="px-4 py-2.5 hidden sm:table-cell"></td>
                  <td className="px-4 py-2.5 text-right tnum">{formatCurrency(totalBilling)}</td>
                  <td className="px-4 py-2.5 text-right text-v-teal tnum">{formatCurrency(totalComm)}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
