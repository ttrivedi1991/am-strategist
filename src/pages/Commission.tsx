import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAM } from "@/context/AMContext";
import { formatCurrency, formatMonthLabel } from "@/lib/utils";
import {
  COMMISSION_TIERS, RETENTION_TIERS, USD_TO_CAD, QUARTER, QUARTERS, blendedRate,
  computeQuarterOutlook, monthlyCommissionable, mtdCommissionable, quarterEligiblePartners,
  accountMonthlyCommissionable, getRetentionTier, getNextRetentionTier, PRIOR_QUARTER_FINAL,
} from "@/lib/commission";

import { useNavigate } from "react-router-dom";
import {
  TrendingUp, TrendingDown, Users, ArrowRight,
  Flame, DollarSign, Target, AlertTriangle, BrainCircuit,
  ChevronDown, ChevronUp, Package, Scale, History,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

// ── Month filter options ─────────────────────────────────────────────────────

const FILTER_MONTHS = [
  { label: "Jan", week: "Jan 26", q: "Q1 '26" },
  { label: "Feb", week: "Feb 26", q: "Q1 '26" },
  { label: "Mar", week: "Mar 26", q: "Q1 '26" },
  { label: "Apr", week: "Apr 26", q: "Q2 '26" },
  { label: "May", week: "May 26", q: "Q2 '26" },
  { label: "Jun", week: "Jun 26", q: "Q2 '26" },
  { label: "Jul", week: "Jul 26", q: "Q3 '26" },
] as const;

type FilterWeek = typeof FILTER_MONTHS[number]["week"];

const MONTH_STATUS_LABEL = {
  final: "finance-approved",
  closed: "closed · warehouse",
  inProgress: "in progress · projected at pace",
  assumed: "assumed flat",
} as const;

// ── Component ────────────────────────────────────────────────────────────────

export default function Commission() {
  const navigate = useNavigate();
  const am = useAM();
  const [tab, setTab] = useState<"overview" | "sku">("overview");
  const [focusMonth, setFocusMonth] = useState<FilterWeek>("Jul 26");
  const { accounts, selectedAM } = am;
  // Non-null: pages render only after AMContext finishes loading (ProtectedRoute gate).
  const LIVE_META = am.liveMeta!;
  const pace = LIVE_META.mtdPaceByAm[selectedAM.id]; // per-AM pace for display
  const mtdLabel = LIVE_META.mtdLabel;

  // Shared commission math (src/lib/commission.ts) — the finance-sheet model:
  // monthly cohort start → end diffs; WAMGR = net growth ÷ Σ month starts.
  const outlook = computeQuarterOutlook(accounts, selectedAM.id);

  // QoQ comparison — every configured quarter through the same engine
  // (finance finals win where published; Q4 joins when added to QUARTERS).
  const [compareQ, setCompareQ] = useState(QUARTER.label);
  const quarterOutlooks = QUARTERS.map(q => ({ q, o: computeQuarterOutlook(accounts, selectedAM.id, q) }));
  const selectedCompare = quarterOutlooks.find(x => x.q.label === compareQ) ?? quarterOutlooks[quarterOutlooks.length - 1];

  // Quarter TOTALS (Σ of the three months) — the top compare is quarter total
  // vs prior quarter total, per Tanmay: Q4 2025 vs Q1 2026 vs Q2 2026, with
  // the in-progress quarter accumulating and clearly labeled.
  const billingsAt = (week: string) =>
    accounts.reduce((s, a) => s + (a.revenueHistory.find(h => h.week === week)?.mrr ?? 0), 0);
  const mtdBillingsTotal = accounts.reduce((s, a) => s + (a.mtdBilling?.mrr ?? 0), 0);

  const TOTAL_QUARTERS = [
    { label: "Q4 2025", months: ["Oct 25", "Nov 25", "Dec 25"] },
    { label: "Q1 2026", months: ["Jan 26", "Feb 26", "Mar 26"] },
    { label: "Q2 2026", months: ["Apr 26", "May 26", "Jun 26"] },
    { label: "Q3 2026", months: ["Jul 26", "Aug 26", "Sep 26"] },
  ];

  const quarterTotals = TOTAL_QUARTERS.map(q => {
    const closedMonths = q.months.filter(w => billingsAt(w) > 0);
    const complete = closedMonths.length === q.months.length;
    let billings = closedMonths.reduce((s, w) => s + billingsAt(w), 0);
    let comm = closedMonths.reduce((s, w) => s + monthlyCommissionable(accounts, w), 0);
    let note = "";
    if (closedMonths.length === 0 && q.label === QUARTER.label && mtdBillingsTotal > 0) {
      billings = mtdBillingsTotal;
      comm = mtdCommissionable(accounts);
      note = `${formatMonthLabel(mtdLabel)} MTD`;
    } else if (!complete && closedMonths.length > 0) {
      note = `${closedMonths.length} of 3 months`;
    }
    return { ...q, billings, comm, complete, note };
  }).filter(q => q.billings > 0);

  const withGrowth = quarterTotals.map((q, i) => {
    const prev = quarterTotals[i - 1];
    const comparable = prev?.complete && q.complete;
    return {
      ...q,
      billingsDelta: comparable ? q.billings - prev.billings : null,
      commDelta: comparable ? q.comm - prev.comm : null,
    };
  });
  const {
    months, adjustedBook, bookUnderManagement, netQuarterlyGrowth, wamgr,
    tier: currentTier, nextTier, bookUSD, bookCAD, bookGrowthCommissionCAD,
    cohortSize, retentionPct, retentionBonusCAD, retentionOneLossPct, retentionOneLossBonusCAD,
    projectedCommissionCAD, gapToNextTier, nextTierUpliftCAD, tierTargets, paceFactor,
    baselineIsFinal, baselineWarehouseDelta,
  } = outlook;
  const priorFinal = PRIOR_QUARTER_FINAL[selectedAM.id];
  const m1 = months[0];
  const eligible = quarterEligiblePartners(accounts);

  const retentionTier = getRetentionTier(retentionPct);
  const nextRetentionTier = getNextRetentionTier(retentionPct);

  // In-month standing (live, through last business day)
  const mtdComm = mtdCommissionable(accounts);
  const mtdBillings = accounts.reduce((s, a) => s + (a.mtdBilling?.mrr ?? 0), 0);
  const pacePct = (paceFactor - 1) * 100;

  // What the prior quarter's near-miss would have paid at the first tier —
  // the concrete cost of finishing below 0.00% WAMGR.
  const priorFirstTierValue = priorFinal
    ? COMMISSION_TIERS[0].rate * priorFinal.bookUnderManagement * priorFinal.fx
    : 0;

  // ── Chart data: prior-quarter finals + this quarter's trajectory ──────────
  const chartData = [
    ...(priorFinal
      ? priorFinal.months.map(m => ({
          month: formatMonthLabel(m.week).replace(" 20", " '"),
          comm: m.end,
          kind: "prior" as const,
        }))
      : []),
    ...months.map(m => ({
      month: m.status === "inProgress" ? `${m.name.slice(0, 3)} '26 (proj)`
        : m.status === "assumed" ? `${m.name.slice(0, 3)} '26 (est)`
        : `${m.name.slice(0, 3)} '26`,
      comm: m.end,
      kind: m.status === "final" || m.status === "closed" ? ("actual" as const) : ("projected" as const),
    })),
  ];

  // ── Strategy Engine — everything is framed as net-growth dollars, because
  // net quarterly growth telescopes to (September close − July start): every
  // commissionable $/mo you add or protect moves the quarter 1:1. ────────────
  type Strategy = {
    account: string;
    action: string;
    nqgImpact: number; // $/mo commissionable moved — 1:1 into net quarterly growth
    type: "save" | "ai" | "expand";
    urgency: "high" | "medium";
    accountId: string;
  };

  const strategies: Strategy[] = [];

  // 1. Save churning accounts — losing the partner removes their full monthly
  // commissionable from the September close.
  accounts.filter(a => a.health === "churning" && a.mrr > 0).forEach(acc => {
    const comm = acc.productBreakdown.reduce((s, p) => s + (p.mrr > 0 ? p.commissionable : 0), 0);
    strategies.push({
      account: acc.name,
      action: `${formatCurrency(comm)}/mo commissionable at risk — churn hits net growth 1:1 and drops a retention logo`,
      nqgImpact: comm,
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
        nqgImpact: estimatedAIComm,
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
      action: `Billing declining ${formatCurrency(acc.mrrPrev - acc.mrr)}/mo — reversal restores ${formatCurrency(commDecline)}/mo commissionable`,
      nqgImpact: commDecline,
      type: "expand",
      urgency: "medium",
      accountId: acc.id,
    });
  });

  strategies.sort((a, b) => b.nqgImpact - a.nqgImpact);
  const topStrategies = strategies.slice(0, 6);

  const strategyTypeConfig = {
    save: { label: "Churn Risk", icon: AlertTriangle, color: "text-v-red", bg: "bg-v-red/10" },
    ai: { label: "AI Expansion", icon: BrainCircuit, color: "text-v-blue", bg: "bg-v-blue/10" },
    expand: { label: "Decline Risk", icon: TrendingDown, color: "text-v-amber", bg: "bg-v-amber/10" },
  };

  const focusComm = focusMonth === mtdLabel
    ? mtdCommissionable(eligible)
    : monthlyCommissionable(eligible, focusMonth);

  return (
    <div className="animate-fade-in">
      <Header
        title="Commission Analytics"
        subtitle={`${QUARTER.label} · Projected: ${formatCurrency(projectedCommissionCAD)} CAD · WAMGR ${(wamgr * 100).toFixed(2)}% (${currentTier.label === "negative" ? "below 0% — no growth payout" : `${currentTier.label} tier → ${(currentTier.rate * 100).toFixed(2)}% of book`}) · Net growth ${netQuarterlyGrowth >= 0 ? "+" : ""}${formatCurrency(netQuarterlyGrowth)} vs ${formatCurrency(m1.start)} July start`}
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

      {/* Month filter strip — drives the By SKU drill-down (the Overview is a
          quarter view, so the filter only renders on the SKU tab) */}
      {tab === "sku" && <div className="px-6 py-3 flex items-center gap-4 flex-wrap border-b border-border bg-secondary/20">
        <span className="text-xs font-medium text-muted-foreground shrink-0">Focus month:</span>
        {(["Q1 '26", "Q2 '26", "Q3 '26"] as const).map(q => {
          const monthOpts = FILTER_MONTHS.filter(m => m.q === q);
          return (
            <div key={q} className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">{q}</span>
              <div className="flex gap-1">
                {monthOpts.map(m => (
                  <button
                    key={m.week}
                    onClick={() => setFocusMonth(m.week)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                      focusMonth === m.week
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {m.label}{m.week === mtdLabel ? " (MTD)" : ""}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <span className="text-[10px] text-muted-foreground ml-auto hidden sm:block">
          {focusMonth}{focusMonth === mtdLabel ? " (month to date)" : ""} · commissionable {formatCurrency(focusComm)}
        </span>
      </div>}

      {tab === "overview" && <div className="p-6 space-y-6">
        {/* ── QoQ growth comparison ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle>Quarter-over-Quarter Growth</CardTitle>
              <div className="flex items-center gap-1">
                {quarterOutlooks.map(({ q }) => (
                  <button
                    key={q.label}
                    onClick={() => setCompareQ(q.label)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      compareQ === q.label ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
                <span className="text-[10px] text-muted-foreground ml-1">Q4 joins when it opens</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quarter totals side by side — total vs prior-quarter total */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className="text-left text-[10px] text-muted-foreground uppercase tracking-wide border-b border-border">
                    <th className="py-2 pr-3 font-semibold">Quarter</th>
                    <th className="py-2 px-3 font-semibold text-right">Total Billings</th>
                    <th className="py-2 px-3 font-semibold text-right">Billings Growth (QoQ)</th>
                    <th className="py-2 px-3 font-semibold text-right">Total Commissionable</th>
                    <th className="py-2 px-3 font-semibold text-right">Commissionable Growth (QoQ)</th>
                    <th className="py-2 pl-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {withGrowth.map(q => (
                    <tr key={q.label}>
                      <td className="py-2 pr-3 font-semibold text-foreground">{q.label}</td>
                      <td className="py-2 px-3 text-right tnum font-semibold">{formatCurrency(q.billings)}</td>
                      <td className={`py-2 px-3 text-right tnum font-semibold ${q.billingsDelta == null ? "text-muted-foreground" : q.billingsDelta < 0 ? "text-v-red" : "text-v-green"}`}>
                        {q.billingsDelta == null
                          ? "—"
                          : `${q.billingsDelta >= 0 ? "+" : "−"}${formatCurrency(Math.abs(q.billingsDelta))} (${q.billingsDelta >= 0 ? "+" : ""}${((q.billingsDelta / (q.billings - q.billingsDelta)) * 100).toFixed(1)}%)`}
                      </td>
                      <td className="py-2 px-3 text-right tnum font-semibold text-v-teal">{formatCurrency(q.comm)}</td>
                      <td className={`py-2 px-3 text-right tnum font-semibold ${q.commDelta == null ? "text-muted-foreground" : q.commDelta < 0 ? "text-v-red" : "text-v-green"}`}>
                        {q.commDelta == null
                          ? "—"
                          : `${q.commDelta >= 0 ? "+" : "−"}${formatCurrency(Math.abs(q.commDelta))} (${q.commDelta >= 0 ? "+" : ""}${((q.commDelta / (q.comm - q.commDelta)) * 100).toFixed(1)}%)`}
                      </td>
                      <td className="py-2 pl-3 text-muted-foreground">
                        {q.complete ? "complete" : q.note ? `in progress · ${q.note}` : "in progress"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Selected quarter month-by-month cohort */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-3 py-2 bg-secondary/50 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                {selectedCompare.q.label} month-by-month (cohort start → end)
              </div>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border">
                  {selectedCompare.o.months.map(m => (
                    <tr key={m.week}>
                      <td className="px-3 py-1.5 font-medium text-foreground">{m.name}</td>
                      <td className="px-3 py-1.5 text-right tnum">{formatCurrency(m.start)}</td>
                      <td className="px-1 py-1.5 text-center text-muted-foreground">→</td>
                      <td className="px-3 py-1.5 text-right tnum font-semibold">{formatCurrency(m.end)}</td>
                      <td className={`px-3 py-1.5 text-right tnum font-semibold ${m.diff < 0 ? "text-v-red" : "text-v-green"}`}>
                        {m.diff >= 0 ? "+" : "−"}{formatCurrency(Math.abs(m.diff))}
                      </td>
                      <td className="px-3 py-1.5 text-right text-[10px] text-muted-foreground">{MONTH_STATUS_LABEL[m.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Quarter totals = the three months summed (billings raw; commissionable at comp-plan rates, finance actuals where published). Growth compares complete quarters only — the in-progress quarter accumulates and starts comparing once it closes. WAMGR and the cohort scoring stay below, where the commission math lives.
            </p>
          </CardContent>
        </Card>

        {/* ── In-month standing (live) ── */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-v-blue/5 border border-v-blue/20">
          <DollarSign className="w-4 h-4 text-v-blue mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {formatMonthLabel(mtdLabel)} so far: {formatCurrency(mtdComm)} commissionable ({formatCurrency(mtdBillings)} billings) through {LIVE_META.dataThrough}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pacing {pacePct >= 0 ? "+" : ""}{pacePct.toFixed(1)}%{pace ? ` vs the same ${pace.spanDays} days of ${formatMonthLabel(pace.priorMonthLabel)}` : ""} (invoiced $, credits excluded) ·
              July close projected at this pace: <span className="font-medium text-foreground">{formatCurrency(m1.end)}</span> vs {formatCurrency(m1.start)} start ({m1.diff >= 0 ? "+" : ""}{formatCurrency(m1.diff)})
            </p>
          </div>
        </div>

        {/* ── Summary row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-v-teal/30 bg-v-teal/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-v-teal" />
                <p className="text-xs font-medium text-muted-foreground">Projected {QUARTER.label} Commission</p>
              </div>
              <p className="text-2xl font-bold text-v-teal">{formatCurrency(projectedCommissionCAD)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Book growth {formatCurrency(bookGrowthCommissionCAD)} + retention {formatCurrency(retentionBonusCAD)} · CAD</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">WAMGR (projected)</p>
              </div>
              <p className={`text-2xl font-bold ${wamgr >= 0.01 ? "text-v-green" : wamgr >= 0 ? "text-v-amber" : "text-v-red"}`}>
                {(wamgr * 100).toFixed(2)}%
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Net growth ÷ {formatCurrency(adjustedBook)} book · {wamgr < 0 ? "negative growth → 0% payout" : `${currentTier.label} tier → ${(currentTier.rate * 100).toFixed(2)}% of book`}
              </p>
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
              <p className="text-[10px] text-muted-foreground mt-1">
                ≈ September close − July start · {nextTier ? `${formatCurrency(gapToNextTier)} to ${nextTier.label} tier` : "top tier"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">Logo Retention</p>
              </div>
              <p className={`text-2xl font-bold ${retentionPct >= 98 ? "text-v-green" : retentionPct >= 95 ? "text-v-amber" : "text-v-red"}`}>
                {retentionPct.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">{cohortSize} logos · assumes no cancellations · {formatCurrency(retentionBonusCAD)} bonus</p>
            </CardContent>
          </Card>
        </div>

        {/* ── How the quarter is scored — the finance-sheet model ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-v-blue" />
                  How {QUARTER.label} Is Scored
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Finance's model: each month has a cohort start and end. WAMGR = the three month-diffs summed, divided by the three month-starts summed.
                  Because each start chains from the prior close, <span className="font-medium text-foreground">your quarter ≈ September close minus July start</span> — mid-quarter dips wash out if you recover them.
                </p>
              </div>
              <Badge variant={wamgr >= 0.01 ? "success" : wamgr >= 0 ? "warning" : "danger"}>
                WAMGR {(wamgr * 100).toFixed(2)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {months.map(m => (
                <div key={m.week} className={`p-3 rounded-lg border ${
                  m.status === "inProgress" ? "border-v-blue/30 bg-v-blue/5"
                  : m.status === "assumed" ? "border-dashed border-border bg-secondary/20"
                  : "border-border bg-secondary/30"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-foreground">{m.name}</p>
                    <span className="text-[10px] text-muted-foreground">{MONTH_STATUS_LABEL[m.status]}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Start</p>
                      <p className="font-medium tnum">{formatCurrency(m.start)}</p>
                    </div>
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">End</p>
                      <p className="font-medium tnum">{formatCurrency(m.end)}</p>
                    </div>
                  </div>
                  <p className={`text-sm font-bold mt-2 ${m.diff >= 0 ? "text-v-green" : "text-v-red"}`}>
                    {m.diff >= 0 ? "+" : ""}{formatCurrency(m.diff)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 p-3 rounded-lg bg-secondary/40 border border-border flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
              <span className="text-muted-foreground">
                Net growth <span className={`font-semibold ${netQuarterlyGrowth >= 0 ? "text-v-green" : "text-v-red"}`}>{netQuarterlyGrowth >= 0 ? "+" : ""}{formatCurrency(netQuarterlyGrowth)}</span>
              </span>
              <span className="text-muted-foreground">÷ Σ month starts <span className="font-semibold text-foreground">{formatCurrency(adjustedBook)}</span></span>
              <span className="text-muted-foreground">= WAMGR <span className={`font-semibold ${wamgr >= 0 ? "text-v-green" : "text-v-red"}`}>{(wamgr * 100).toFixed(2)}%</span></span>
              <span className="text-muted-foreground">→ rate <span className="font-semibold text-foreground">{(currentTier.rate * 100).toFixed(2)}%</span></span>
              <span className="text-muted-foreground">× Σ month ends <span className="font-semibold text-foreground">{formatCurrency(bookUnderManagement)}</span> (USD × {USD_TO_CAD})</span>
              <span className="text-muted-foreground">= <span className="font-semibold text-v-teal">{formatCurrency(bookGrowthCommissionCAD)} CAD</span></span>
            </div>

            <p className="text-[10px] text-muted-foreground mt-2">
              July start anchored to finance's verified Q2 close ({formatCurrency(m1.start)}){baselineIsFinal && Math.abs(baselineWarehouseDelta) > 1000
                ? ` — warehouse June sum runs ${formatCurrency(Math.abs(baselineWarehouseDelta))} ${baselineWarehouseDelta > 0 ? "higher" : "lower"} because June one-time/annual invoices aren't in finance's growth basis`
                : ""}. Finance applies small cohort adjustments for partner reassignments, so final figures can drift slightly.
            </p>
          </CardContent>
        </Card>

        {/* ── Tier targets: what you need to do ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-v-amber" />
              What Each Tier Takes
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Growth telescopes, so each tier is simply a September close to beat. Payouts shown at the current projected book of {formatCurrency(bookUnderManagement)} (+ {formatCurrency(retentionBonusCAD)} retention bonus).
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-secondary/60 text-muted-foreground border-b border-border">
                    <th className="text-left px-4 py-2 font-medium">WAMGR tier</th>
                    <th className="text-right px-4 py-2 font-medium">Rate</th>
                    <th className="text-right px-4 py-2 font-medium">Net growth needed</th>
                    <th className="text-right px-4 py-2 font-medium">Sep close needed</th>
                    <th className="text-right px-4 py-2 font-medium">vs projection</th>
                    <th className="text-right px-4 py-2 font-medium text-v-teal">Est. payout (CAD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tierTargets.map(t => {
                    const isCurrent = wamgr >= 0 && t.wamgr === currentTier.wamgr;
                    const isNext = nextTier?.wamgr === t.wamgr;
                    const onTrack = t.gapFromProjection <= 0;
                    return (
                      <tr key={t.label} className={
                        isCurrent ? "bg-v-teal/5 font-semibold"
                        : isNext ? "bg-v-amber/5"
                        : ""
                      }>
                        <td className="px-4 py-2">
                          {isCurrent ? "▶ " : ""}{t.label}
                          {isCurrent && <span className="ml-1.5 text-[10px] text-v-teal font-semibold">current trajectory</span>}
                          {isNext && <span className="ml-1.5 text-[10px] text-v-amber font-semibold">next tier</span>}
                        </td>
                        <td className="text-right px-4 py-2">{(t.rate * 100).toFixed(2)}%</td>
                        <td className="text-right px-4 py-2 tnum">+{formatCurrency(t.netGrowthNeeded)}</td>
                        <td className="text-right px-4 py-2 tnum font-medium">{formatCurrency(t.quarterCloseNeeded)}</td>
                        <td className={`text-right px-4 py-2 ${onTrack ? "text-v-green" : "text-muted-foreground"}`}>
                          {onTrack ? "on track" : `+${formatCurrency(t.gapFromProjection)} to go`}
                        </td>
                        <td className="text-right px-4 py-2 font-semibold text-v-teal tnum">{formatCurrency(t.estPayoutCAD)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {wamgr < 0 && (
              <div className="m-4 mt-3 p-2.5 rounded-lg bg-v-red/5 border border-v-red/20">
                <p className="text-[10px] font-semibold text-v-red">
                  Projection is below 0.00% WAMGR — the growth component pays $0 unless September closes at {formatCurrency(m1.start)} or higher.
                  Even reaching flat (0.00%) is worth {formatCurrency(tierTargets[0].estPayoutCAD)}.
                </p>
              </div>
            )}
            {nextTier && wamgr >= 0 && (
              <div className="m-4 mt-3 p-2.5 rounded-lg bg-v-amber/5 border border-v-amber/20">
                <p className="text-[10px] font-semibold text-v-amber">
                  {formatCurrency(gapToNextTier)} more net growth by September close unlocks the {nextTier.label} tier — worth +{formatCurrency(nextTierUpliftCAD)}.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Trajectory chart + payout breakdown ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Month-End Commissionable — {priorFinal ? "Q2 finals + " : ""}{QUARTER.label} trajectory</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cohort month-end values (finance basis) · dashed line = July start {formatCurrency(m1.start)} — close September above it and the quarter is positive
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <YAxis domain={["dataMin - 15000", "dataMax + 5000"]} tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    formatter={(v: any) => [formatCurrency(v as number), "Month-end commissionable"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                  />
                  <ReferenceLine y={m1.start} stroke="#6366f1" strokeDasharray="4 4" />
                  <Bar dataKey="comm" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.kind === "prior" ? "#d1fae5" : entry.kind === "projected" ? "#d1d5db" : "#00B67A"}
                        opacity={entry.kind === "prior" ? 0.8 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Finance-style month table */}
              <div className="mt-4 rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/60 text-muted-foreground">
                      <th className="text-left px-3 py-2 font-medium">Month</th>
                      <th className="text-right px-3 py-2 font-medium">Start</th>
                      <th className="text-right px-3 py-2 font-medium">End</th>
                      <th className="text-right px-3 py-2 font-medium">Diff</th>
                      <th className="text-right px-3 py-2 font-medium hidden sm:table-cell">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {months.map(m => (
                      <tr key={m.week} className={m.status === "assumed" ? "opacity-50 italic" : ""}>
                        <td className="px-3 py-2 font-medium">{formatMonthLabel(m.week)}</td>
                        <td className="text-right px-3 py-2 tnum">{formatCurrency(m.start)}</td>
                        <td className="text-right px-3 py-2 tnum font-medium">{formatCurrency(m.end)}</td>
                        <td className={`text-right px-3 py-2 font-semibold ${m.diff >= 0 ? "text-v-green" : "text-v-red"}`}>
                          {m.diff >= 0 ? "+" : ""}{formatCurrency(m.diff)}
                        </td>
                        <td className="text-right px-3 py-2 text-muted-foreground hidden sm:table-cell">{MONTH_STATUS_LABEL[m.status]}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-secondary/50 font-semibold border-t-2 border-border">
                      <td className="px-3 py-2">{QUARTER.label}</td>
                      <td className="text-right px-3 py-2 tnum">{formatCurrency(adjustedBook)}</td>
                      <td className="text-right px-3 py-2 tnum">{formatCurrency(bookUnderManagement)}</td>
                      <td className={`text-right px-3 py-2 ${netQuarterlyGrowth >= 0 ? "text-v-green" : "text-v-red"}`}>
                        {netQuarterlyGrowth >= 0 ? "+" : ""}{formatCurrency(netQuarterlyGrowth)}
                      </td>
                      <td className={`text-right px-3 py-2 ${wamgr >= 0 ? "text-v-green" : "text-v-red"} hidden sm:table-cell`}>
                        WAMGR {(wamgr * 100).toFixed(2)}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Right column: Payout math + Logo Retention */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Payout Math</CardTitle>
                <p className="text-xs text-muted-foreground">{QUARTER.label} · all output in CAD</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Book = Σ month ends (Jul–Sep)</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">USD partners</span>
                    <span className="font-medium">{formatCurrency(bookUSD)} USD</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">CAD partners (Cantrex, Home.CA)</span>
                    <span className="font-medium">{formatCurrency(bookCAD)} CAD</span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-border pt-1.5 mt-1">
                    <span className="text-muted-foreground">Commission rate ({currentTier.label === "negative" ? "negative WAMGR" : `${currentTier.label} tier`})</span>
                    <span className="font-medium">{(currentTier.rate * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">USD → CAD (finance Q2 rate)</span>
                    <span className="font-medium">× {USD_TO_CAD.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold border-t border-border pt-1.5">
                    <span>Book Growth Commission</span>
                    <span className="text-v-teal">{formatCurrency(bookGrowthCommissionCAD)} CAD</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Logo Retention Bonus</span>
                    <span className="text-v-blue">{formatCurrency(retentionBonusCAD)} CAD</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t-2 border-border pt-2 mt-1">
                    <span>Projected {QUARTER.label} Total</span>
                    <span className="text-v-teal">{formatCurrency(projectedCommissionCAD)} CAD</span>
                  </div>
                </div>

                {/* Tier ladder */}
                <div className="space-y-1 border-t border-border pt-3">
                  {COMMISSION_TIERS.map((t, i) => {
                    const isActive = wamgr >= 0 && t.wamgr === currentTier.wamgr;
                    const isNext = nextTier?.wamgr === t.wamgr;
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
                          {isActive ? "▶ " : ""}{t.label} WAMGR
                        </span>
                        <span className={isActive ? "font-bold text-v-teal" : isNext ? "text-v-amber" : "text-muted-foreground"}>
                          {(t.rate * 100).toFixed(2)}% of book
                        </span>
                      </div>
                    );
                  })}
                  {wamgr < 0 && (
                    <p className="text-[10px] text-v-red font-medium px-2">Below every tier — negative growth pays 0% of book.</p>
                  )}
                </div>
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
                  <span className={`text-2xl font-bold ${retentionPct >= 98 ? "text-v-green" : retentionPct >= 95 ? "text-v-amber" : "text-v-red"}`}>
                    {retentionPct.toFixed(1)}%
                  </span>
                  <Badge variant={retentionPct >= 98 ? "success" : retentionPct >= 95 ? "warning" : "danger"}>
                    {formatCurrency(retentionBonusCAD)} bonus
                  </Badge>
                </div>

                <div className="w-full bg-secondary rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${retentionPct >= 98 ? "bg-v-green" : retentionPct >= 95 ? "bg-v-amber" : "bg-v-red"}`}
                    style={{ width: `${Math.min(retentionPct, 100)}%` }}
                  />
                </div>

                <div className="space-y-1">
                  {RETENTION_TIERS.map((t, i) => {
                    const isActive = retentionTier.pct === t.pct;
                    const isNext = nextRetentionTier?.pct === t.pct;
                    return (
                      <div key={i} className={`flex justify-between text-xs px-2 py-0.5 rounded ${isActive ? "bg-v-blue/10 text-v-blue font-semibold" : isNext ? "text-v-amber" : "text-muted-foreground"}`}>
                        <span>{isActive ? "▶ " : ""}{t.pct.toFixed(0)}%</span>
                        <span>{formatCurrency(t.payout)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="p-2 rounded-lg bg-v-amber/5 border border-v-amber/20">
                  <p className="text-[10px] font-semibold text-v-amber mb-0.5">
                    One cancellation costs real money
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Losing 1 of {cohortSize} logos in any month drops the quarter to {retentionOneLossPct.toFixed(1)}% → {formatCurrency(retentionOneLossBonusCAD)} bonus
                    ({formatCurrency(retentionBonusCAD - retentionOneLossBonusCAD)} less), plus their commissionable leaves your net growth.
                  </p>
                </div>

                {priorFinal && (
                  <div className="p-2 rounded-lg bg-secondary/50 border border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground">Q2 actual (finance): {priorFinal.retentionPct.toFixed(2)}% → {formatCurrency(priorFinal.retentionBonusCAD)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Prior-quarter recap (finance-verified) ── */}
        {priorFinal && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-muted-foreground" />
                {priorFinal.quarter} Final — Finance-Verified
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                From the rep-wise payout sheet · this is the exact math your commission was paid on
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-secondary/60 text-muted-foreground">
                        <th className="text-left px-3 py-2 font-medium">Month</th>
                        <th className="text-right px-3 py-2 font-medium">Start</th>
                        <th className="text-right px-3 py-2 font-medium">End</th>
                        <th className="text-right px-3 py-2 font-medium">Diff</th>
                        <th className="text-right px-3 py-2 font-medium">Logos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {priorFinal.months.map(m => (
                        <tr key={m.week}>
                          <td className="px-3 py-2 font-medium">{formatMonthLabel(m.week)}</td>
                          <td className="text-right px-3 py-2 tnum">{formatCurrency(m.start)}</td>
                          <td className="text-right px-3 py-2 tnum">{formatCurrency(m.end)}</td>
                          <td className={`text-right px-3 py-2 font-semibold ${m.end - m.start >= 0 ? "text-v-green" : "text-v-red"}`}>
                            {m.end - m.start >= 0 ? "+" : ""}{formatCurrency(m.end - m.start)}
                          </td>
                          <td className="text-right px-3 py-2 text-muted-foreground">{m.logosStart} → {m.logosEnd}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-secondary/50 font-semibold border-t-2 border-border">
                        <td className="px-3 py-2">Quarter</td>
                        <td className="text-right px-3 py-2 tnum">{formatCurrency(priorFinal.adjustedBook)}</td>
                        <td className="text-right px-3 py-2 tnum">{formatCurrency(priorFinal.bookUnderManagement)}</td>
                        <td className={`text-right px-3 py-2 ${priorFinal.netQuarterlyGrowth >= 0 ? "text-v-green" : "text-v-red"}`}>
                          {priorFinal.netQuarterlyGrowth >= 0 ? "+" : ""}{formatCurrency(priorFinal.netQuarterlyGrowth)}
                        </td>
                        <td className={`text-right px-3 py-2 ${priorFinal.wamgr >= 0 ? "text-v-green" : "text-v-red"}`}>{(priorFinal.wamgr * 100).toFixed(2)}%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">WAMGR</span><span className={`font-semibold ${priorFinal.wamgr >= 0 ? "text-v-green" : "text-v-red"}`}>{(priorFinal.wamgr * 100).toFixed(2)}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Eligible rate</span><span className="font-semibold">{(priorFinal.rate * 100).toFixed(2)}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Book growth commission</span><span className="font-semibold">{formatCurrency(priorFinal.rate * priorFinal.bookUnderManagement * priorFinal.fx)} CAD</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Logo retention</span><span className="font-semibold">{priorFinal.retentionPct.toFixed(2)}% → {formatCurrency(priorFinal.retentionBonusCAD)}</span></div>
                  <div className="flex justify-between border-t border-border pt-2 font-bold"><span>Total paid</span><span className="text-v-teal">{formatCurrency(priorFinal.totalCAD)} CAD</span></div>
                  {priorFinal.netQuarterlyGrowth < 0 && (
                    <div className="p-2.5 rounded-lg bg-v-red/5 border border-v-red/20 mt-2">
                      <p className="text-[10px] font-semibold text-v-red mb-0.5">The lesson from {priorFinal.quarter}</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        June recovered May's dip, but the quarter still closed {formatCurrency(Math.abs(priorFinal.netQuarterlyGrowth))} below the April start.
                        Missing 0.00% WAMGR by that sliver cost the entire growth component — ≈{formatCurrency(priorFirstTierValue)} at the first tier alone.
                        The September close is the whole game.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Strategy Engine ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-v-amber" />
                Moves That Grow Your WAMGR
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">Ranked by net-growth impact</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Every commissionable $/mo you add or protect lands 1:1 in net quarterly growth (September close vs July start) — sorted by dollars moved
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {topStrategies.map((s, i) => {
              const cfg = strategyTypeConfig[s.type];
              const Icon = cfg.icon;
              const wamgrBps = adjustedBook > 0 ? (s.nqgImpact / adjustedBook) * 10000 : 0;
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
                      <p className="text-xs font-bold text-v-teal">{s.type === "save" ? "protects" : "+"} {formatCurrency(s.nqgImpact)}</p>
                      <p className="text-[10px] text-muted-foreground">net growth · {wamgrBps.toFixed(0)} bps WAMGR</p>
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

      {tab === "sku" && <SkuBreakdown accounts={accounts} focusMonth={focusMonth} mtdLabel={mtdLabel} onOutreach={id => navigate(`/outreach?account=${id}`)} />}
    </div>
  );
}

// ── By SKU tab ────────────────────────────────────────────────────────────────

function SkuBreakdown({
  accounts,
  focusMonth,
  mtdLabel,
  onOutreach,
}: {
  accounts: import("@/data/types").Account[];
  focusMonth: FilterWeek;
  mtdLabel: string;
  onOutreach: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const isMTD = focusMonth === mtdLabel;

  // ── Single month-aware base ─────────────────────────────────────────────────
  // For each account: compute actual monthly billing + commissionable, then
  // scale each product's snapshot values proportionally. This makes BOTH tables
  // respond to the month filter. The inclusion rate per product is stable (it
  // comes from the commission plan, not billing volume), so the scale factor
  // is applied uniformly across all products for that account.
  // The in-progress month (MTD) uses live month-to-date billings.
  const monthlyBase = accounts.map(a => {
    const monthBilling = isMTD
      ? (a.mtdBilling?.mrr ?? 0)
      : a.revenueHistory.find(h => h.week === focusMonth)?.mrr ?? 0;
    const monthComm = isMTD
      ? monthBilling * blendedRate(a)
      : accountMonthlyCommissionable(a, focusMonth);
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

  const monthTag = `${focusMonth}${isMTD ? " (MTD)" : ""}`;

  return (
    <div className="p-6 space-y-6">

      {/* ── By account ── shown first — responds directly to month filter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            By Account — {monthTag}
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
            By Product — {monthTag}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Each product's billing and commissionable scaled to {monthTag} using each account's monthly totals · sorted by commissionable desc
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
