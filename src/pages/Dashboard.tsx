import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, pctChange, getQoQBaseMRR, getLatestMRR, QOQ_BASELINE_LABEL } from "@/lib/utils";
import { LIVE_META } from "@/data/liveMerge";
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

// Commission tier structure (from Jan 2026 plan)
const COMMISSION_TIERS = [
  { wamgr: 0.0000, rate: 0.0060, label: "0.00%" },
  { wamgr: 0.0025, rate: 0.0090, label: "0.25%" },
  { wamgr: 0.0050, rate: 0.0120, label: "0.50%" },
  { wamgr: 0.0100, rate: 0.0150, label: "1.00%" },
  { wamgr: 0.0200, rate: 0.0188, label: "2.00%" },
  { wamgr: 0.0300, rate: 0.0225, label: "3.00%" },
  { wamgr: 0.0500, rate: 0.0300, label: "5.00%" },
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { accounts, orgAlerts, selectedAM } = useAM();
  // Latest-month billings from revenueHistory — same source as the trend chart,
  // so the card and chart always agree (a.mrr can lag a month behind).
  const totalMRR = accounts.reduce((s, a) => s + getLatestMRR(a.revenueHistory), 0);

  // Get latest month from revenueTrend (last entry)
  const latestTrend = selectedAM.revenueTrend[selectedAM.revenueTrend.length - 1];
  const latestMonth = latestTrend?.week ?? "May 26";

  // Commission calculation (Q2 2026)
  function commRate(acc: typeof accounts[0]) {
    const totalBilling = acc.productBreakdown.reduce((s, p) => s + (p.mrr > 0 ? p.mrr : 0), 0);
    const totalComm = acc.productBreakdown.reduce((s, p) => s + (p.mrr > 0 ? p.commissionable : 0), 0);
    return totalBilling > 0 ? totalComm / totalBilling : 0.95;
  }

  const existingPartners = accounts.filter(
    a => a.mrr > 0 && new Date(a.onboardedDate) < new Date("2026-04-01")
  );

  function monthlyComm(partners: typeof accounts, monthLabel: string) {
    return partners.reduce((s, acc) => {
      const mrr = acc.revenueHistory.find(h => h.week === monthLabel)?.mrr ?? 0;
      const rate = commRate(acc);
      const onboarding = acc.productBreakdown
        .filter(p => p.category === "Onboarding")
        .reduce((s2, p) => s2 + p.commissionable, 0);
      return s + mrr * rate - onboarding;
    }, 0);
  }

  const marComm = monthlyComm(existingPartners, "Mar 26");
  const aprComm = monthlyComm(existingPartners, "Apr 26");
  const mayComm = monthlyComm(existingPartners, "May 26");
  const junCommEst = mayComm;

  const aprGrowth = aprComm - marComm;
  const mayGrowth = mayComm - aprComm;
  const partialNetGrowth = aprGrowth + mayGrowth;
  const partialStartingBase = marComm + aprComm;
  const wamgr = partialStartingBase > 0 ? partialNetGrowth / partialStartingBase : 0;

  const bookUnderManagement = aprComm + mayComm + junCommEst;
  const currentTier = getCommissionTier(wamgr);
  const nextTier = getNextCommissionTier(wamgr);

  const fullBase = marComm + aprComm + mayComm;
  const additionalCommNeededForNextTier = nextTier
    ? nextTier.wamgr * fullBase - partialNetGrowth
    : 0;

  // QoQ: compare current month to the prior-quarter close (Mar 2026 for Q2)
  const totalMRRQoQBase = accounts.reduce((s, a) => s + getQoQBaseMRR(a.revenueHistory), 0);
  const quotaPct = Math.round((selectedAM.achievedMRR / selectedAM.quota) * 100);
  const revenueChange = pctChange(totalMRR, totalMRRQoQBase);

  // Current-month billings through last business day (from `npm run refresh`)
  const mtdTotal = accounts.reduce((s, a) => s + (a.mtdBilling?.mrr ?? 0), 0);

  return (
    <div className="animate-fade-in">
      <Header
        title={`Good morning, ${selectedAM.name.split(" ")[0]} 👋`}
        subtitle={`Here's your strategic overview for the week of ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
      />

      <div className="p-6 space-y-6">
        {/* Book Health Warning */}
        {revenueChange < 0 ? (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-v-red/5 border border-v-red/20">
            <TrendingDown className="w-4 h-4 text-v-red mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Book billings are down {Math.abs(revenueChange).toFixed(1)}% QoQ — {formatCurrency(totalMRR)} vs {formatCurrency(totalMRRQoQBase)} at {QOQ_BASELINE_LABEL} close
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Source: f_billing_partner_snpm · {latestMonth} actuals vs {QOQ_BASELINE_LABEL} close (prior-quarter baseline per commission plan)
                {mtdTotal > 0 && <> · <span className="font-medium text-foreground">{LIVE_META.mtdLabel} MTD: {formatCurrency(mtdTotal)}</span> through {LIVE_META.dataThrough}</>}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-v-teal/5 border border-v-teal/20">
            <TrendingUp className="w-4 h-4 text-v-teal mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Book billings are up {revenueChange.toFixed(1)}% QoQ — {formatCurrency(totalMRR)} vs {formatCurrency(totalMRRQoQBase)} at {QOQ_BASELINE_LABEL} close
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Source: f_billing_partner_snpm · {latestMonth} actuals vs {QOQ_BASELINE_LABEL} close (prior-quarter baseline per commission plan)
                {mtdTotal > 0 && <> · <span className="font-medium text-foreground">{LIVE_META.mtdLabel} MTD: {formatCurrency(mtdTotal)}</span> through {LIVE_META.dataThrough}</>}
              </p>
            </div>
          </div>
        )}

        {/* Commission KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="WAMGR (Current)"
            value={`${(wamgr * 100).toFixed(2)}%`}
            changeLabel={`At ${currentTier.label} tier → ${(currentTier.rate * 100).toFixed(2)}% of book`}
            icon={TrendingUp}
            iconColor={wamgr >= 0.01 ? "text-v-green" : wamgr >= 0 ? "text-v-amber" : "text-v-red"}
            trend={wamgr >= 0.01 ? "up" : "down"}
            onClick={() => navigate("/commission")}
          />
          <StatCard
            label={`Total Billings (${latestMonth})`}
            value={formatCurrency(totalMRR)}
            change={revenueChange}
            changeLabel={`vs ${QOQ_BASELINE_LABEL} close (QoQ)`}
            icon={DollarSign}
            iconColor="text-v-blue"
            onClick={() => navigate("/accounts")}
          />
          <StatCard
            label={`Commissionable $ (${latestMonth})`}
            value={formatCurrency(mayComm)}
            changeLabel={`Q2 book under management: ${formatCurrency(bookUnderManagement)}`}
            icon={DollarSign}
            iconColor="text-v-teal"
            onClick={() => navigate("/commission")}
          />
          <Card className="border-v-amber/30 bg-v-amber/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-v-amber" />
                <p className="text-xs font-medium text-muted-foreground">Gap to Next Tier</p>
              </div>
              <p className="text-2xl font-bold text-v-amber">{nextTier ? formatCurrency(Math.max(0, additionalCommNeededForNextTier)) : "At max"}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {nextTier ? `Grow commissionable to hit ${nextTier.label} WAMGR` : "You're at the highest tier!"}
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
                  <p className="text-xs text-muted-foreground mt-1">Recurring Billings · Channel partners · Nov 2025–{latestMonth} · f_billing_partner_snpm</p>
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
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
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

          {/* Quota Gauge */}
          <Card>
            <CardHeader>
              <CardTitle>Quota Progress</CardTitle>
              <p className="text-xs text-muted-foreground">{latestMonth}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center py-2">
                <div className="relative w-28 h-28">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 36 36">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f0f0f0" strokeWidth="3" />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={quotaPct >= 100 ? "#00B67A" : "#F59E0B"}
                      strokeWidth="3"
                      strokeDasharray={`${quotaPct}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-foreground">{quotaPct}%</span>
                    <span className="text-[10px] text-muted-foreground">attained</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Achieved MRR</span>
                  <span className="font-medium">{formatCurrency(selectedAM.achievedMRR)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Monthly Quota</span>
                  <span className="font-medium">{formatCurrency(selectedAM.quota)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Gap to Close</span>
                  <span className="font-medium text-v-amber">{formatCurrency(selectedAM.quota - selectedAM.achievedMRR)}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/outreach")}>
                Build Outreach Plan <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Weekly Priority Actions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-v-amber" />
                  This Week's Priority Actions
                </CardTitle>
                <Badge variant="warning">{selectedAM.weeklyActions.filter(a => a.priority === "high").length} urgent</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {selectedAM.weeklyActions.map(action => (
                <div key={action.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group">
                  <div className="mt-0.5">
                    {action.priority === "high"
                      ? <AlertTriangle className="w-3.5 h-3.5 text-v-red" />
                      : action.priority === "medium"
                      ? <Clock className="w-3.5 h-3.5 text-v-amber" />
                      : <CheckCircle2 className="w-3.5 h-3.5 text-v-teal" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{action.account}</span>
                      <Badge variant={priorityColor[action.priority as keyof typeof priorityColor]} className="text-[10px]">
                        {priorityLabel[action.priority as keyof typeof priorityLabel]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{action.action}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{action.due}</span>
                </div>
              ))}
            </CardContent>
          </Card>

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
    </div>
  );
}
