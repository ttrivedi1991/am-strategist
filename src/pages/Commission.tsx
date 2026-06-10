import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAM } from "@/context/AMContext";
import { formatCurrency } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, TrendingDown, Users, ArrowRight,
  Flame, DollarSign, Target, AlertTriangle, BrainCircuit
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";

// ── Commission plan constants (Jan 2026) ────────────────────────────────────

const COMMISSION_TIERS = [
  { wamgr: 0.0000, rate: 0.0060, label: "0.00%" },
  { wamgr: 0.0025, rate: 0.0090, label: "0.25%" },
  { wamgr: 0.0050, rate: 0.0120, label: "0.50%" },
  { wamgr: 0.0100, rate: 0.0150, label: "1.00%" },
  { wamgr: 0.0200, rate: 0.0188, label: "2.00%" },
  { wamgr: 0.0300, rate: 0.0225, label: "3.00%" },
  { wamgr: 0.0500, rate: 0.0300, label: "5.00%" },
];

const RETENTION_TIERS = [
  { pct: 0.950, bonus: 900 },
  { pct: 0.960, bonus: 1350 },
  { pct: 0.970, bonus: 1800 },
  { pct: 0.980, bonus: 2250 },
  { pct: 0.990, bonus: 2813 },
  { pct: 1.000, bonus: 3375 },
];

function getCommissionTier(wamgr: number) {
  let current = COMMISSION_TIERS[0];
  for (const tier of COMMISSION_TIERS) {
    if (wamgr >= tier.wamgr) current = tier;
    else break;
  }
  return current;
}

function getNextCommissionTier(wamgr: number) {
  for (let i = 0; i < COMMISSION_TIERS.length - 1; i++) {
    if (wamgr < COMMISSION_TIERS[i + 1].wamgr) return COMMISSION_TIERS[i + 1];
  }
  return null;
}

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
  const { accounts } = useAM();

  // Commissionable rate per account derived from Apr 2026 product breakdown
  function commRate(acc: typeof accounts[0]) {
    const totalBilling = acc.productBreakdown.reduce((s, p) => s + (p.mrr > 0 ? p.mrr : 0), 0);
    const totalComm = acc.productBreakdown.reduce((s, p) => s + (p.mrr > 0 ? p.commissionable : 0), 0);
    return totalBilling > 0 ? totalComm / totalBilling : 0.95;
  }

  // Existing partners = onboarded before Q2 (Apr 1, 2026). New partners excluded from growth calc per plan.
  const existingPartners = accounts.filter(
    a => a.mrr > 0 && new Date(a.onboardedDate) < new Date("2026-04-01")
  );

  // Monthly commissionable $ for a cohort at a given revenueHistory index (Onboarding excluded)
  function monthlyComm(partners: typeof accounts, histIdx: number) {
    return partners.reduce((s, acc) => {
      const mrr = acc.revenueHistory[histIdx]?.mrr ?? 0;
      const rate = commRate(acc);
      const onboarding = acc.productBreakdown
        .filter(p => p.category === "Onboarding")
        .reduce((s2, p) => s2 + p.commissionable, 0);
      return s + mrr * rate - onboarding;
    }, 0);
  }

  // History indices: Nov25=0, Dec25=1, Jan26=2, Feb26=3, Mar26=4, Apr26=5, May26=6
  const janComm = monthlyComm(existingPartners, 2);
  const febComm = monthlyComm(existingPartners, 3);
  const marComm = monthlyComm(existingPartners, 4); // Q2 baseline (Q1 ending book)
  const aprComm = monthlyComm(existingPartners, 5);
  const mayComm = monthlyComm(existingPartners, 6);

  // Q2 2026 WAMGR: Apr and May actuals (June TBD)
  // WAMGR = Net Quarterly Growth / sum of starting values each month
  const aprGrowth = aprComm - marComm;
  const mayGrowth = mayComm - aprComm;
  const partialNetGrowth = aprGrowth + mayGrowth; // Jun growth unknown
  const partialStartingBase = marComm + aprComm;  // Mar + Apr starting values (2 of 3 months)
  const wamgr = partialStartingBase > 0 ? partialNetGrowth / partialStartingBase : 0;

  // June estimate: flat at May (conservative)
  const junCommEst = mayComm;

  // Book under management Q2 = Apr + May + Jun (using Jun estimate)
  const bookUnderManagement = aprComm + mayComm + junCommEst;
  const currentTier = getCommissionTier(wamgr);
  const nextTier = getNextCommissionTier(wamgr);

  const bookGrowthCommission = currentTier.rate * bookUnderManagement;

  // Additional June growth needed to reach next tier
  const fullBase = marComm + aprComm + mayComm;
  const additionalCommNeededForNextTier = nextTier
    ? nextTier.wamgr * fullBase - partialNetGrowth
    : 0;
  const additionalCommissionAtNextTier = nextTier
    ? (nextTier.rate - currentTier.rate) * bookUnderManagement
    : 0;

  // ── Logo Retention ──────────────────────────────────────────────────────────
  // Rule: cohort = partners with billing > $0 in a given month, assigned to Tanmay.
  // Cancelled = billing goes to $0. Average monthly retention across Q2 (Apr, May, Jun est).
  // History indices: Mar=4, Apr=5, May=6

  function countRetained(prevIdx: number, currIdx: number) {
    return accounts.filter(a =>
      (a.revenueHistory[prevIdx]?.mrr ?? 0) > 0 &&
      (a.revenueHistory[currIdx]?.mrr ?? 0) > 0
    ).length;
  }

  function countCohort(histIdx: number) {
    return accounts.filter(a => (a.revenueHistory[histIdx]?.mrr ?? 0) > 0).length;
  }

  const marCohort = countCohort(4);  // Q2 start — denominator for April retention
  const aprCohort = countCohort(5);  // April — denominator for May retention

  const aprRetainedCount = countRetained(4, 5);
  const mayRetainedCount = countRetained(5, 6);

  const aprRetention = marCohort > 0 ? aprRetainedCount / marCohort : 1;
  const mayRetention = aprCohort > 0 ? mayRetainedCount / aprCohort : 1;
  const junRetentionEst = 1.0; // estimated: no further cancellations in June

  const logoRetentionPct = (aprRetention + mayRetention + junRetentionEst) / 3;
  const retentionTier = getRetentionTier(logoRetentionPct);
  const nextRetentionTier = getNextRetentionTier(logoRetentionPct);

  // Partners who actually cancelled in Q2 — billing went to $0 during Apr or May
  const cancelledInQ2 = accounts.filter(a => {
    const marMrr = a.revenueHistory[4]?.mrr ?? 0;
    const aprMrr = a.revenueHistory[5]?.mrr ?? 0;
    const mayMrr = a.revenueHistory[6]?.mrr ?? 0;
    return (marMrr > 0 && aprMrr === 0) || (aprMrr > 0 && mayMrr === 0);
  });

  // ── Total projected commission ──────────────────────────────────────────────
  const totalProjected = bookGrowthCommission + retentionTier.bonus;

  // ── Chart data ──────────────────────────────────────────────────────────────
  const chartData = [
    { month: "Jan 26", comm: janComm, isBaseline: true },
    { month: "Feb 26", comm: febComm, isBaseline: true },
    { month: "Mar 26", comm: marComm, isBaseline: true },
    { month: "Apr 26", comm: aprComm, isBaseline: false },
    { month: "May 26", comm: mayComm, isBaseline: false },
    { month: "Jun 26 (est)", comm: junCommEst, isEstimate: true },
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
    const rate = commRate(acc);
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
        subtitle={`Q2 2026 · Projected: ${formatCurrency(totalProjected)} · WAMGR: ${(wamgr * 100).toFixed(2)}% (${currentTier.label} tier) · Commissionable book: ${formatCurrency(bookUnderManagement)}`}
      />

      <div className="p-6 space-y-6">
        {/* ── Summary row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-v-teal/30 bg-v-teal/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-v-teal" />
                <p className="text-xs font-medium text-muted-foreground">Projected Commission</p>
              </div>
              <p className="text-2xl font-bold text-v-teal">{formatCurrency(totalProjected)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Book growth + retention bonus · Q2</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">WAMGR</p>
              </div>
              <p className={`text-2xl font-bold ${wamgr >= 0.01 ? "text-v-green" : wamgr >= 0 ? "text-v-amber" : "text-v-red"}`}>
                {(wamgr * 100).toFixed(2)}%
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">At <strong>{currentTier.label}</strong> → {(currentTier.rate * 100).toFixed(2)}% of book</p>
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
              <p className={`text-2xl font-bold ${partialNetGrowth >= 0 ? "text-v-green" : "text-v-red"}`}>
                {partialNetGrowth >= 0 ? "+" : ""}{formatCurrency(partialNetGrowth)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Commissionable · Apr + May vs Mar</p>
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
                    Existing partners only · Onboarding excluded · f_billing_partner_snpm
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
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={(entry as any).isEstimate ? "#d1d5db" : entry.isBaseline ? "#d1fae5" : "#00B67A"} />
                    ))}
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
                    <tr className="bg-secondary/20 text-muted-foreground">
                      <td className="px-3 py-2">Mar 26 (Q2 baseline)</td>
                      <td className="text-right px-3 py-2 font-medium">{formatCurrency(marComm)}</td>
                      <td className="text-right px-3 py-2">—</td>
                      <td className="text-right px-3 py-2">—</td>
                    </tr>
                    {[
                      { label: "Apr 26", comm: aprComm, growth: aprGrowth, prev: marComm },
                      { label: "May 26", comm: mayComm, growth: mayGrowth, prev: aprComm },
                      { label: "Jun 26 (est)", comm: junCommEst, growth: junCommEst - mayComm, prev: mayComm, isEst: true },
                    ].map(row => (
                      <tr key={row.label} className={(row as any).isEst ? "opacity-50 italic" : ""}>
                        <td className="px-3 py-2 font-medium">{row.label}</td>
                        <td className="text-right px-3 py-2 font-medium">{formatCurrency(row.comm)}</td>
                        <td className={`text-right px-3 py-2 font-semibold ${row.growth >= 0 ? "text-v-green" : "text-v-red"}`}>
                          {row.growth >= 0 ? "+" : ""}{formatCurrency(row.growth)}
                        </td>
                        <td className={`text-right px-3 py-2 ${row.growth >= 0 ? "text-v-green" : "text-v-red"}`}>
                          {row.prev > 0 ? `${row.growth >= 0 ? "+" : ""}${((row.growth / row.prev) * 100).toFixed(2)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-secondary/50 font-semibold border-t-2 border-border">
                      <td className="px-3 py-2">Q2 Partial WAMGR (Apr+May)</td>
                      <td className="text-right px-3 py-2">{formatCurrency(bookUnderManagement)} <span className="text-[10px] font-normal text-muted-foreground">(book est.)</span></td>
                      <td className={`text-right px-3 py-2 ${partialNetGrowth >= 0 ? "text-v-green" : "text-v-red"}`}>
                        {partialNetGrowth >= 0 ? "+" : ""}{formatCurrency(partialNetGrowth)}
                      </td>
                      <td className={`text-right px-3 py-2 ${wamgr >= 0 ? "text-v-green" : "text-v-red"}`}>
                        WAMGR {(wamgr * 100).toFixed(2)}%
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
                <p className="text-xs text-muted-foreground">Q2 2026 projected payout</p>
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

                {/* Payout math */}
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Book under management</span>
                    <span className="font-medium">{formatCurrency(bookUnderManagement)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Commission rate</span>
                    <span className="font-medium">{(currentTier.rate * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold border-t border-border pt-2">
                    <span>Book Growth (75%)</span>
                    <span className="text-v-teal">{formatCurrency(bookGrowthCommission)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Logo Retention (25%)</span>
                    <span className="text-v-blue">{formatCurrency(retentionTier.bonus)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-border pt-2">
                    <span>Total Projected Q2</span>
                    <span className="text-v-teal">{formatCurrency(totalProjected)}</span>
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
      </div>
    </div>
  );
}
