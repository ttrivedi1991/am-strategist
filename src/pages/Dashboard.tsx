import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatMonthLabel, pctChange, getQoQBaseMRR, getLatestMRR, QOQ_BASELINE_LABEL } from "@/lib/utils";
import { computeQuarterOutlook, mtdCommissionable, monthlyCommissionable, billingAdjustment, QUARTER } from "@/lib/commission";
import { recommendedActions } from "@/lib/insights";
import {
  buildBookFacts, composeFallback, generateExecSummary,
  summaryCacheKey, loadCachedSummary, cacheSummary, type ExecSummary,
} from "@/lib/execSummary";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAM } from "@/context/AMContext";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  DollarSign, AlertTriangle, ArrowRight,
  CheckCircle2, Clock, Flame, TrendingUp, TrendingDown
} from "lucide-react";

const priorityColor = { high: "danger", medium: "warning", low: "info" } as const;
const priorityLabel = { high: "Urgent", medium: "This Week", low: "FYI" } as const;

export default function Dashboard() {
  const navigate = useNavigate();
  const am = useAM();
  const { accounts, orgAlerts, selectedAM } = am;
  // Non-null: pages render only after AMContext finishes loading (ProtectedRoute gate).
  const LIVE_META = am.liveMeta!;
  // Latest-month billings from revenueHistory — same source as the trend chart,
  // so the card and chart always agree (a.mrr can lag a month behind).
  const totalMRR = accounts.reduce((s, a) => s + getLatestMRR(a.revenueHistory), 0);

  // Get latest month from revenueTrend (last entry)
  const latestTrend = selectedAM.revenueTrend[selectedAM.revenueTrend.length - 1];
  const latestMonth = latestTrend?.week ?? "May 26";
  const latestMonthLabel = formatMonthLabel(latestMonth); // "May 2026", never date-like

  // Commission outlook — shared math in src/lib/commission.ts, following the
  // finance payout-sheet model: monthly cohort start→end diffs; WAMGR = net
  // quarterly growth ÷ Σ month starts; in-progress month projected at pace.
  const outlook = computeQuarterOutlook(accounts, selectedAM.id);
  const { wamgr, tier: currentTier, nextTier, paceFactor, netQuarterlyGrowth, months } = outlook;
  const pace = LIVE_META.mtdPaceByAm[selectedAM.id]; // per-AM pace for display

  // QoQ: compare current month to the prior-quarter close (Jun 2026 for Q3)
  const totalMRRQoQBase = accounts.reduce((s, a) => s + getQoQBaseMRR(a.revenueHistory), 0);
  const revenueChange = pctChange(totalMRR, totalMRRQoQBase);
  // Context view: same comparison excluding one-time billing credits (official numbers keep them)
  const latestAdj = accounts.reduce((s, a) => s + billingAdjustment(a.name, latestMonth), 0);
  const baseAdj = accounts.reduce((s, a) => s + billingAdjustment(a.name, "Jun 26"), 0);
  const adjRevenueChange = pctChange(totalMRR + latestAdj, totalMRRQoQBase + baseAdj);

  // Month focus filter: defaults to the in-progress month (live MTD)
  const monthOptions = [...selectedAM.revenueTrend.map(t => t.week), LIVE_META.mtdLabel].reverse();
  const [focusMonth, setFocusMonth] = useState<string>(LIVE_META.mtdLabel);
  const focusIsMTD = focusMonth === LIVE_META.mtdLabel;
  const focusLabel = formatMonthLabel(focusMonth) + (focusIsMTD ? " MTD" : "");
  const pacePct = (paceFactor - 1) * 100;

  // Current-month billings through last business day (from `npm run refresh`)
  const mtdTotal = accounts.reduce((s, a) => s + (a.mtdBilling?.mrr ?? 0), 0);
  const focusBillings = focusIsMTD
    ? mtdTotal
    : accounts.reduce((s, a) => s + (a.revenueHistory.find(h => h.week === focusMonth)?.mrr ?? 0), 0);
  const focusComm = focusIsMTD ? mtdCommissionable(accounts) : monthlyCommissionable(accounts, focusMonth);
  const focusChange = focusIsMTD ? undefined : pctChange(focusBillings, totalMRRQoQBase);
  const tierProgressPct = wamgr < 0
    ? 0
    : nextTier
      ? Math.min(100, Math.round(((wamgr - currentTier.wamgr) / (nextTier.wamgr - currentTier.wamgr)) * 100))
      : 100;

  // Executive summary — ONE consistent narrative for every reader. Gemini
  // writes prose from an exact fact sheet (cached per data refresh);
  // deterministic fallback when no key is available.
  const recActions = recommendedActions(accounts, orgAlerts, 5);
  const [summary, setSummary] = useState<ExecSummary | null>(null);
  const [summarySource, setSummarySource] = useState<"ai" | "fallback" | null>(null);

  useEffect(() => {
    const facts = buildBookFacts(accounts, orgAlerts, pace, LIVE_META.mtdLabel, mtdTotal);
    const key = summaryCacheKey(selectedAM.id, LIVE_META.dataThrough);
    const cached = loadCachedSummary(key);
    if (cached) { setSummary(cached); setSummarySource("ai"); return; }
    setSummary(composeFallback(facts));
    setSummarySource("fallback");
    if (am.geminiApiKey) {
      const ctrl = new AbortController();
      generateExecSummary(facts, am.geminiApiKey, ctrl.signal)
        .then(s => { cacheSummary(key, s); setSummary(s); setSummarySource("ai"); })
        .catch(() => { /* fallback already showing */ });
      return () => ctrl.abort();
    }
  }, [accounts, orgAlerts, selectedAM.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="animate-fade-in">
      <Header
        title="Book of Business"
        subtitle={`${selectedAM.name} · ${selectedAM.title}`}
      />

      <div className="p-6 space-y-6">
        {/* Book Health Warning */}
        {revenueChange < 0 ? (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-v-red/5 border border-v-red/20">
            <TrendingDown className="w-4 h-4 text-v-red mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Book billings are down {Math.abs(revenueChange).toFixed(1)}% QoQ — {formatCurrency(totalMRR)} vs {formatCurrency(totalMRRQoQBase)} at {QOQ_BASELINE_LABEL} close
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Source: f_billing_partner_snpm · {latestMonthLabel} actuals vs {QOQ_BASELINE_LABEL} close (prior-quarter baseline per commission plan) · excluding one-time billing credits: {adjRevenueChange >= 0 ? "+" : ""}{adjRevenueChange.toFixed(1)}% QoQ
                {mtdTotal > 0 && <> · <span className="font-medium text-foreground">{formatMonthLabel(LIVE_META.mtdLabel)} month-to-date: {formatCurrency(mtdTotal)}</span> through {LIVE_META.dataThrough} {pace ? `· pacing ${pacePct >= 0 ? "+" : ""}${pacePct.toFixed(1)}% vs same span of ${formatMonthLabel(pace.priorMonthLabel)}` : ""}</>}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-v-teal/5 border border-v-teal/20">
            <TrendingUp className="w-4 h-4 text-v-teal mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Book billings are up {revenueChange.toFixed(1)}% QoQ — {formatCurrency(totalMRR)} vs {formatCurrency(totalMRRQoQBase)} at {QOQ_BASELINE_LABEL} close
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Source: f_billing_partner_snpm · {latestMonthLabel} actuals vs {QOQ_BASELINE_LABEL} close (prior-quarter baseline per commission plan) · excluding one-time billing credits: {adjRevenueChange >= 0 ? "+" : ""}{adjRevenueChange.toFixed(1)}% QoQ
                {mtdTotal > 0 && <> · <span className="font-medium text-foreground">{formatMonthLabel(LIVE_META.mtdLabel)} month-to-date: {formatCurrency(mtdTotal)}</span> through {LIVE_META.dataThrough} {pace ? `· pacing ${pacePct >= 0 ? "+" : ""}${pacePct.toFixed(1)}% vs same span of ${formatMonthLabel(pace.priorMonthLabel)}` : ""}</>}
              </p>
            </div>
          </div>
        )}

        {/* Executive Summary — one consistent narrative for every reader */}
        {summary && (
          <Card>
            <CardHeader>
              <CardTitle>Executive Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-base font-semibold text-foreground leading-snug">{summary.headline}</p>
              <p className="text-sm text-foreground leading-relaxed">{summary.performance}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-v-red/5 border border-v-red/15">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-v-red mb-1">Risks</p>
                  <p className="text-xs text-foreground leading-relaxed">{summary.risks}</p>
                </div>
                <div className="p-3 rounded-lg bg-v-teal/5 border border-v-teal/15">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-v-teal mb-1">Outlook</p>
                  <p className="text-xs text-foreground leading-relaxed">{summary.outlook}</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground border-t border-border pt-2">
                Numbers from BigQuery closes through {LIVE_META.dataThrough}{summarySource === "fallback" ? "" : " · narrative by Gemini from an exact fact sheet"} · unexplained movements are flagged, never guessed.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Recommended Actions — headed by the business shift, then the partner */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-v-amber" />
                Top 5 Recommended Actions
              </CardTitle>
              <Badge variant="warning">{recActions.filter(a => a.urgency === "high").length} urgent</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recActions.map(action => (
              <div
                key={`${action.account.id}-${action.theme}`}
                onClick={() => navigate(`/partner/${action.account.id}`)}
                className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group cursor-pointer"
              >
                <div className="mt-0.5">
                  {action.urgency === "high"
                    ? <AlertTriangle className="w-3.5 h-3.5 text-v-red" />
                    : action.urgency === "medium"
                    ? <Clock className="w-3.5 h-3.5 text-v-amber" />
                    : <CheckCircle2 className="w-3.5 h-3.5 text-v-teal" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-foreground">{action.theme}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs font-semibold text-foreground">{action.account.name}</span>
                    <Badge variant={priorityColor[action.urgency]} className="text-[10px]">
                      {priorityLabel[action.urgency]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{action.detail}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Month focus filter — scopes only the monthly cards (billings & commissionable) */}
        <div className="flex items-center justify-end gap-2 -mb-3">
          <span className="text-xs text-muted-foreground">
            Focus month <span className="hidden sm:inline text-muted-foreground/70">· changes Billings &amp; Commissionable (WAMGR is quarterly)</span>
          </span>
          <select
            value={focusMonth}
            onChange={e => setFocusMonth(e.target.value)}
            className="text-xs font-medium border border-border rounded-lg px-2 py-1 bg-background hover:bg-secondary transition-colors"
          >
            {monthOptions.map(m => (
              <option key={m} value={m}>{formatMonthLabel(m)}{m === LIVE_META.mtdLabel ? " (month to date)" : ""}</option>
            ))}
          </select>
        </div>

        {/* Commission KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label={`Total Billings (${focusLabel})`}
            value={formatCurrency(focusBillings)}
            change={focusChange}
            changeLabel={focusIsMTD
              ? `Through ${LIVE_META.dataThrough} · pacing ${pacePct >= 0 ? "+" : ""}${pacePct.toFixed(1)}% vs same span of ${formatMonthLabel(pace.priorMonthLabel)}`
              : `vs ${QOQ_BASELINE_LABEL} close (QoQ)`}
            icon={DollarSign}
            iconColor="text-v-blue"
            onClick={() => navigate("/accounts")}
          />
          <StatCard
            label={`Commissionable $ (${focusLabel})`}
            value={formatCurrency(focusComm)}
            changeLabel={`${QUARTER.label} book under management: ${formatCurrency(outlook.bookUnderManagement)}`}
            icon={DollarSign}
            iconColor="text-v-teal"
            onClick={() => navigate("/commission")}
          />
          <Card className="border-v-amber/30 bg-v-amber/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-v-amber" />
                <p className="text-xs font-medium text-muted-foreground">Gap to Next Tier ({QUARTER.label})</p>
              </div>
              <p className="text-2xl font-bold text-v-amber">{nextTier ? formatCurrency(outlook.gapToNextTier) : "At max"}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {nextTier ? `Net growth needed by Sep close to hit ${nextTier.label} WAMGR` : "You're at the highest tier!"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Revenue Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Book Billings Trend</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Recurring Billings · Channel partners · Nov 2025–{latestMonthLabel} · f_billing_partner_snpm</p>
                </div>
                <Badge variant={revenueChange >= 0 ? "success" : "danger"}>
                  {revenueChange > 0 ? "+" : ""}{revenueChange}% QoQ
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={selectedAM.revenueTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tickFormatter={(w: string) => w.replace(/ (\d{2})$/, " '$1")} tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    formatter={(v: any) => [formatCurrency(v as number), "Billings"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="mrr" stroke="#EF4444" strokeWidth={2} fill="url(#mrrGrad)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Quarter Commission Outlook — finance payout-sheet model */}
          <Card>
            <CardHeader>
              <CardTitle>{QUARTER.label} Commission Outlook</CardTitle>
              <p className="text-xs text-muted-foreground">Finance model: net growth ÷ Σ month starts · July start anchored to verified Q2 close · July projected at {(paceFactor * 100).toFixed(0)}% pace</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center py-2">
                <div className="relative w-28 h-28">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 36 36">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f0f0f0" strokeWidth="3" />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={wamgr >= 0 ? "#00B67A" : "#EF4444"}
                      strokeWidth="3"
                      strokeDasharray={`${Math.max(tierProgressPct, 2)}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-foreground">{formatCurrency(outlook.projectedCommissionCAD)}</span>
                    <span className="text-[10px] text-muted-foreground">projected (CAD)</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">WAMGR (projected)</span>
                  <span className={`font-medium ${wamgr < 0 ? "text-v-red" : "text-v-green"}`}>{(wamgr * 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Net quarterly growth</span>
                  <span className={`font-medium ${netQuarterlyGrowth < 0 ? "text-v-red" : "text-v-green"}`}>{netQuarterlyGrowth >= 0 ? "+" : ""}{formatCurrency(netQuarterlyGrowth)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Eligible rate</span>
                  <span className="font-medium">{(currentTier.rate * 100).toFixed(2)}%{wamgr < 0 && " (negative growth)"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Book growth commission</span>
                  <span className="font-medium">{formatCurrency(outlook.bookGrowthCommissionCAD)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Retention bonus (at {outlook.retentionPct.toFixed(1)}%, no cancellations)</span>
                  <span className="font-medium">{formatCurrency(outlook.retentionBonusCAD)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                  Quarterly growth telescopes to September close − July start ({formatCurrency(months[0].start)}, finance-verified). Close September above the start and the growth component pays.
                </p>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/commission")}>
                Full Commission Breakdown <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Top Org Alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-v-red" />
                Partner Intelligence Alerts
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/intel")}>
                View all <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {orgAlerts.slice(0, 4).map(alert => (
              <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer" onClick={() => navigate("/intel")}>
                <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${alert.urgency === "high" ? "bg-v-red" : alert.urgency === "medium" ? "bg-v-amber" : "bg-v-teal"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{alert.accountName}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{alert.title}</p>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{alert.date.slice(5)}</span>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => navigate("/intel")}>
              View all {orgAlerts.length} alerts <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
