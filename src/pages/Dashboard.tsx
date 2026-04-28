import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, pctChange } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useAM } from "@/context/AMContext";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  DollarSign, Users, BrainCircuit, AlertTriangle, ArrowRight,
  CheckCircle2, Clock, Flame, TrendingUp, TrendingDown
} from "lucide-react";

const priorityColor = { high: "danger", medium: "warning", low: "info" } as const;
const priorityLabel = { high: "Urgent", medium: "This Week", low: "FYI" } as const;

export default function Dashboard() {
  const navigate = useNavigate();
  const { accounts, orgAlerts, selectedAM } = useAM();
  const totalMRR = accounts.reduce((s, a) => s + a.mrr, 0);
  // QoQ: compare Mar 2026 (current) to Dec 2025 (Q4 close) — AMs are paid on QoQ growth
  const totalMRRQ4 = accounts.reduce((s, a) => s + (a.revenueHistory[2]?.mrr ?? 0), 0);
  const activeAccounts = accounts.filter(a => a.mrr > 0); // churned accounts excluded from active metrics
  const miaCount = activeAccounts.filter(a => a.isMIA).length;
  const aiPowerCount = activeAccounts.filter(a => a.aiAdoption === "power" || a.aiAdoption === "growth").length;
  const quotaPct = Math.round((selectedAM.achievedMRR / selectedAM.quota) * 100);

  const revenueChange = pctChange(totalMRR, totalMRRQ4);

  return (
    <div className="animate-fade-in">
      <Header
        title={`Good morning, ${selectedAM.name.split(" ")[0]} 👋`}
        subtitle="Here's your strategic overview for the week of April 27, 2026"
      />

      <div className="p-6 space-y-6">
        {/* Book Health Warning */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-v-red/5 border border-v-red/20">
          <TrendingDown className="w-4 h-4 text-v-red mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Book declined $31K Oct–Jan, recovered in Feb–Mar — but the core book is still contracting
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              $334K (Oct) → $303K (Jan low) → $315K (Mar actual) · Recovery driven by SM Marketing International joining at $15K · Underlying book ex-SMM: ~$300K · 4 accounts churned · UWM down $22K · Fiska collapsed 64% in March.
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total MRR"
            value={formatCurrency(totalMRR)}
            change={revenueChange}
            changeLabel="vs Q4 2025 (QoQ)"
            icon={DollarSign}
            iconColor="text-v-blue"
            onClick={() => navigate("/accounts")}
          />
          <StatCard
            label="Quota Attainment"
            value={`${quotaPct}%`}
            changeLabel={`${formatCurrency(selectedAM.quota - selectedAM.achievedMRR)} gap`}
            icon={TrendingUp}
            iconColor={quotaPct >= 100 ? "text-v-green" : "text-v-amber"}
            trend={quotaPct >= 100 ? "up" : "down"}
          />
          <StatCard
            label="MIA Partners"
            value={`${miaCount}`}
            changeLabel={`of ${activeAccounts.length} active accounts`}
            icon={Users}
            iconColor="text-v-red"
            trend={miaCount > 2 ? "down" : "flat"}
            onClick={() => navigate("/mia")}
          />
          <StatCard
            label="AI Power Users"
            value={`${aiPowerCount}`}
            changeLabel={`of ${activeAccounts.length} active accounts`}
            icon={BrainCircuit}
            iconColor="text-v-purple"
            trend="up"
            onClick={() => navigate("/ai-adoption")}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Revenue Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Book Revenue Trend</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Monthly billings · Channel partners · Oct 2025–Mar 2026 actuals (BigQuery)</p>
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
                    formatter={(v: number) => [formatCurrency(v), "MRR"]}
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
              <p className="text-xs text-muted-foreground">April 2026</p>
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
