import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Account } from "@/data/mock";
import { formatCurrency, daysSince, pctChange } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useAM } from "@/context/AMContext";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip
} from "recharts";
import {
  Search, TrendingUp, TrendingDown, Minus, ArrowRight,
  BrainCircuit, Clock, MapPin, ChevronDown
} from "lucide-react";

const healthBadge: Record<Account["health"], { variant: "success" | "warning" | "danger" | "info"; label: string }> = {
  champion: { variant: "success", label: "Champion" },
  healthy: { variant: "info", label: "Healthy" },
  "at-risk": { variant: "warning", label: "At Risk" },
  churning: { variant: "danger", label: "Churning" },
};

const aiTierBadge: Record<Account["aiAdoption"], { color: string; label: string }> = {
  none: { color: "text-muted-foreground", label: "No AI" },
  basic: { color: "text-v-teal", label: "Basic" },
  growth: { color: "text-v-blue", label: "Growth" },
  power: { color: "text-v-purple", label: "Power" },
};

export default function Accounts() {
  const navigate = useNavigate();
  const { accounts } = useAM();
  const [search, setSearch] = useState("");
  const [filterHealth, setFilterHealth] = useState("all");
  const [filterVertical, setFilterVertical] = useState("all");
  const [sortBy, setSortBy] = useState<"mrr" | "days" | "health">("mrr");

  const verticals = [...new Set(accounts.map(a => a.vertical))];

  const filtered = accounts
    .filter(a => {
      const q = search.toLowerCase();
      return (
        (a.name.toLowerCase().includes(q) || a.contactName.toLowerCase().includes(q)) &&
        (filterHealth === "all" || a.health === filterHealth) &&
        (filterVertical === "all" || a.vertical === filterVertical)
      );
    })
    .sort((a, b) => {
      if (sortBy === "mrr") return b.mrr - a.mrr;
      if (sortBy === "days") return daysSince(a.lastMeeting) - daysSince(b.lastMeeting);
      const order = { churning: 0, "at-risk": 1, healthy: 2, champion: 3 };
      return order[a.health] - order[b.health];
    });

  const activeAccounts = accounts.filter(a => a.mrr > 0);
  const totalMRR = activeAccounts.reduce((s, a) => s + a.mrr, 0);

  return (
    <div className="animate-fade-in">
      <Header
        title="Book of Business"
        subtitle={`${activeAccounts.length} active accounts · ${formatCurrency(totalMRR)} MRR · ${accounts.length - activeAccounts.length} churned`}
      />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search accounts or contacts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={filterHealth}
            onChange={e => setFilterHealth(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Health</option>
            <option value="champion">Champion</option>
            <option value="healthy">Healthy</option>
            <option value="at-risk">At Risk</option>
            <option value="churning">Churning</option>
          </select>
          <select
            value={filterVertical}
            onChange={e => setFilterVertical(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Verticals</option>
            {verticals.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Sort:</span>
            {(["mrr", "days", "health"] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-2 py-1 rounded ${sortBy === s ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
              >
                {s === "mrr" ? "MRR" : s === "days" ? "Days since meeting" : "Health"}
              </button>
            ))}
          </div>
        </div>

        {/* Account Cards */}
        <div className="space-y-2">
          {filtered.map(account => {
            // QoQ: compare current MRR (Mar 2026) to Q4 close (Dec 2025, revenueHistory[2])
            const decMRR = account.revenueHistory[2]?.mrr ?? 0;
            const mrrChg = decMRR > 0 ? pctChange(account.mrr, decMRR) : 0;
            const days = daysSince(account.lastMeeting);
            const health = healthBadge[account.health];
            const ai = aiTierBadge[account.aiAdoption];

            return (
              <Card key={account.id} className="hover:shadow-md transition-all hover:border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Identity */}
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                      {account.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
                      {/* Name & Contact */}
                      <div className="sm:col-span-2 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-foreground truncate">{account.name}</p>
                          {account.isMIA && (
                            <Badge variant="danger" className="text-[10px]">MIA</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">{account.contactName} · {account.contactTitle}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <MapPin className="w-2.5 h-2.5" />{account.country} · {account.vertical}
                          </span>
                        </div>
                      </div>

                      {/* MRR */}
                      <div>
                        <p className="text-xs text-muted-foreground">MRR</p>
                        <p className="text-sm font-bold text-foreground">{formatCurrency(account.mrr)}</p>
                        <div className="flex items-center gap-1">
                          {mrrChg > 0 ? <TrendingUp className="w-3 h-3 text-v-green" /> : mrrChg < 0 ? <TrendingDown className="w-3 h-3 text-v-red" /> : <Minus className="w-3 h-3 text-muted-foreground" />}
                          <span className={`text-[10px] font-medium ${mrrChg > 0 ? "text-v-green" : mrrChg < 0 ? "text-v-red" : "text-muted-foreground"}`}>
                            {mrrChg > 0 ? "+" : ""}{mrrChg}% QoQ
                          </span>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="space-y-1">
                        <div><Badge variant={health.variant}>{health.label}</Badge></div>
                        <div className="flex items-center gap-1">
                          <BrainCircuit className={`w-3 h-3 ${ai.color}`} />
                          <span className={`text-[10px] font-medium ${ai.color}`}>{ai.label}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="w-2.5 h-2.5" />
                          {days}d since meeting
                        </div>
                      </div>

                      {/* Sparkline */}
                      <div className="hidden sm:block">
                        <ResponsiveContainer width="100%" height={40}>
                          <AreaChart data={account.revenueHistory} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                            <defs>
                              <linearGradient id={`g-${account.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={mrrChg >= 0 ? "#00B67A" : "#EF4444"} stopOpacity={0.2} />
                                <stop offset="95%" stopColor={mrrChg >= 0 ? "#00B67A" : "#EF4444"} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <Tooltip
                              formatter={(v: number) => [formatCurrency(v), "MRR"]}
                              contentStyle={{ borderRadius: 6, border: "1px solid #e5e7eb", fontSize: 10 }}
                            />
                            <Area
                              type="monotone"
                              dataKey="mrr"
                              stroke={mrrChg >= 0 ? "#00B67A" : "#EF4444"}
                              strokeWidth={1.5}
                              fill={`url(#g-${account.id})`}
                              dot={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <Button variant="ghost" size="icon" onClick={() => navigate(`/outreach?account=${account.id}`)}>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {/* Products */}
                  <div className="mt-2 flex flex-wrap gap-1 pl-12">
                    {account.products.map(p => (
                      <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{p}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <ChevronDown className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No accounts match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
