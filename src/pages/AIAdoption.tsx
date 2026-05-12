import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AI_ADOPTION_DATA } from "@/data/mock";
import { useNavigate } from "react-router-dom";
import { useAM } from "@/context/AMContext";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { CheckCircle2, ArrowRight, TrendingUp } from "lucide-react";

export default function AIAdoption() {
  const navigate = useNavigate();
  const { accounts, selectedAM } = useAM();
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "ai" | "noai" | "multi">("all");

  const trendData = AI_ADOPTION_DATA[selectedAM.id] ?? [];

  const withAI = accounts.filter(a => a.aiAdoption !== "none");
  const noAI = accounts.filter(a => a.aiAdoption === "none");
  const adoptionRate = accounts.length > 0 ? Math.round((withAI.length / accounts.length) * 100) : 0;

  // Total AI products in use
  const allProducts = withAI.flatMap(a => a.products);
  const productFreq = allProducts.reduce((acc, p) => {
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topProducts = Object.entries(productFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const pieData = [
    { name: "Active AI", value: withAI.length, color: "#0055FF" },
    { name: "No AI", value: noAI.length, color: "#e5e7eb" },
  ];

  return (
    <div className="animate-fade-in">
      <Header
        title="AI Adoption"
        subtitle={`${withAI.length} of ${accounts.length} partners have active AI products · ${adoptionRate}% penetration`}
      />

      <div className="p-6 space-y-6">
        {/* Summary Stats — clickable to filter lists below */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { key: "ai" as const, label: "Partners with AI", value: withAI.length, sub: `${adoptionRate}% of book`, color: "text-v-blue", ring: "ring-v-blue/30" },
            { key: "noai" as const, label: "No Active AI", value: noAI.filter(a => a.mrr > 0).length, sub: "expansion targets", color: "text-foreground", ring: "ring-border" },
            { key: "all" as const, label: "Unique AI Products", value: Object.keys(productFreq).length, sub: "in active use", color: "text-v-purple", ring: "ring-v-purple/30" },
            { key: "multi" as const, label: "Multi-product", value: withAI.filter(a => a.products.length > 1).length, sub: "partners with 2+ AI", color: "text-v-teal", ring: "ring-v-teal/30" },
          ].map(card => (
            <button
              key={card.key}
              onClick={() => setActiveFilter(activeFilter === card.key ? "all" : card.key)}
              className={`rounded-xl border bg-card p-4 text-left transition-all hover:shadow-sm ${
                activeFilter === card.key ? `ring-2 ${card.ring} border-transparent` : "border-border"
              }`}
            >
              <p className="text-xs font-medium text-muted-foreground mb-1">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.sub}</p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Adoption Trend */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Partners with Active AI Products — Jan to Apr 2026</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
                  <Bar dataKey="noAI" stackId="a" fill="#e5e7eb" name="No AI" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="withAI" stackId="a" fill="#0055FF" name="Has AI" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-v-blue" />
                  <span className="text-xs text-muted-foreground">Has active AI products</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-border" />
                  <span className="text-xs text-muted-foreground">No active AI products</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Distribution + Top Products */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={2}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, name) => [v, name]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {pieData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                        <span className="text-muted-foreground">{d.name}</span>
                      </div>
                      <span className="font-medium">{d.value} ({Math.round((d.value / accounts.length) * 100)}%)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {topProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top AI Products in Use</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {topProducts.map(([product, count]) => (
                  <div key={product} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate mr-2">{product}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="h-1.5 rounded-full bg-v-blue" style={{ width: `${(count / topProducts[0][1]) * 48}px` }} />
                      <span className="font-medium w-4 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            )}
          </div>
        </div>

        {/* Partners with active AI */}
        {(activeFilter === "all" || activeFilter === "ai" || activeFilter === "multi") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-v-teal" />
              Partners with Active AI Products
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {withAI.length} partners · BigQuery Mar 2026 actuals · sorted by product count
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {withAI
              .filter(a => activeFilter === "multi" ? a.products.length > 1 : true)
              .sort((a, b) => b.products.length - a.products.length)
              .map(account => (
                <div
                  key={account.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-secondary/20 cursor-pointer hover:bg-secondary/40 transition-colors"
                  onClick={() => setExpandedAccount(expandedAccount === account.id ? null : account.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{account.name}</span>
                      <span className="text-[10px] text-muted-foreground">{account.vertical}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {account.products.map(p => (
                        <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-v-blue/10 text-v-blue font-medium">{p}</span>
                      ))}
                    </div>

                    {/* Expanded product billing breakdown */}
                    {expandedAccount === account.id && account.productBreakdown && account.productBreakdown.length > 0 && (
                      <div className="mt-3 rounded-lg bg-background border border-border p-3">
                        <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Full Product Billing — Mar 2026</p>
                        <div className="space-y-1">
                          {account.productBreakdown
                            .filter(p => p.mrr > 0)
                            .slice(0, 12)
                            .map(p => (
                              <div key={p.name} className="flex items-center justify-between text-xs gap-2">
                                <span className="text-muted-foreground truncate">{p.name}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-medium">{formatCurrency(p.mrr)}</span>
                                  {p.commissionable < p.mrr * 0.9 && (
                                    <span className="text-[9px] text-v-amber px-1 py-0.5 rounded bg-v-amber/10">
                                      {Math.round(p.commissionable / p.mrr * 100)}% comm.
                                    </span>
                                  )}
                                </div>
                              </div>
                          ))}
                        </div>
                        <div className="mt-2 pt-2 border-t border-border flex justify-between text-xs font-medium">
                          <span>Total Billing</span>
                          <span>{formatCurrency(account.productBreakdown.reduce((s, p) => s + p.mrr, 0))}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); navigate(`/accounts`); }}>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
        )}

        {/* No AI — expansion targets */}
        {(activeFilter === "all" || activeFilter === "noai") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-v-purple" />
              Expansion Targets — No Active AI
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {noAI.filter(a => a.mrr > 0).length} active partners with zero AI products · sorted by MRR
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {noAI
              .filter(a => a.mrr > 0)
              .sort((a, b) => b.mrr - a.mrr)
              .map(account => (
                <div key={account.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-secondary/20">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{account.name}</span>
                      <span className="text-[10px] text-muted-foreground">{account.vertical}</span>
                      <Badge variant={account.health === "champion" ? "success" : account.health === "at-risk" ? "warning" : "outline"} className="text-[10px]">
                        {account.health}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(account.mrr)}/mo · {account.contactName}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/outreach?account=${account.id}`)}>
                    Outreach <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}
