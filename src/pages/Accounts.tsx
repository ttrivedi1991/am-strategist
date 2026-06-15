import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Account } from "@/data/types";
import { formatCurrency, formatMonthLabel, daysSince, pctChange, getQoQBaseMRR, getLatestMRR } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useAM } from "@/context/AMContext";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip
} from "recharts";
import {
  Search, TrendingUp, TrendingDown, Minus, ArrowRight,
  BrainCircuit, Clock, MapPin, ChevronDown, ChevronUp,
  Star, Package
} from "lucide-react";

const healthBadge: Record<Account["health"], { variant: "success" | "warning" | "danger" | "info"; label: string }> = {
  champion: { variant: "success", label: "Champion" },
  healthy:  { variant: "info",    label: "Healthy"   },
  "at-risk":{ variant: "warning", label: "At Risk"   },
  churning: { variant: "danger",  label: "Churning"  },
};

export default function Accounts() {
  const navigate = useNavigate();
  const { accounts, billingDocs: BILLING_DOCS, billingDocsMtd: BILLING_DOCS_MTD, liveMeta } = useAM();
  const productMonth = liveMeta?.productMonth ? formatMonthLabel(liveMeta.productMonth) : "latest month";
  const [search, setSearch] = useState("");
  const [filterHealth, setFilterHealth] = useState("all");
  const [filterVertical, setFilterVertical] = useState("all");
  const [sortBy, setSortBy] = useState<"mrr" | "days" | "health">("mrr");
  const [expanded, setExpanded] = useState<string | null>(null);

  const verticals = [...new Set(accounts.map(a => a.vertical))].sort();

  // Calculate total commissionable dollars
  function commissionableForAccount(acc: typeof accounts[0]) {
    return acc.productBreakdown.reduce((s, p) => s + (p.mrr > 0 ? p.commissionable : 0), 0);
  }

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
      // Sort by commissionable dollars (most important metric)
      if (sortBy === "mrr") return commissionableForAccount(b) - commissionableForAccount(a);
      if (sortBy === "days") return daysSince(a.lastMeeting) - daysSince(b.lastMeeting);
      const order = { churning: 0, "at-risk": 1, healthy: 2, champion: 3 };
      return order[a.health] - order[b.health];
    });

  // Latest-month billings from revenueHistory — a.mrr can lag a month behind.
  const activeAccounts = accounts.filter(a => getLatestMRR(a.revenueHistory) > 0);
  const totalMRR = activeAccounts.reduce((s, a) => s + getLatestMRR(a.revenueHistory), 0);
  const totalCommissionable = activeAccounts.reduce((s, a) => s + commissionableForAccount(a), 0);

  return (
    <div className="animate-fade-in">
      <Header
        title="Accounts"
        subtitle={`${activeAccounts.length} active partners · ${formatCurrency(totalMRR)} billings · ${formatCurrency(totalCommissionable)} commissionable`}
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
            className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none"
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
            className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none"
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
                {s === "mrr" ? "Commissionable $" : s === "days" ? "Days since meeting" : "Health"}
              </button>
            ))}
          </div>
        </div>

        {/* Account Cards */}
        <div className="space-y-2">
          {filtered.map(account => {
            const latestMRR = getLatestMRR(account.revenueHistory);
            const qoqBase = getQoQBaseMRR(account.revenueHistory);
            const mrrChg = qoqBase > 0 ? pctChange(latestMRR, qoqBase) : 0;
            const days = daysSince(account.lastMeeting);
            const health = healthBadge[account.health];
            const isExpanded = expanded === account.id;
            const hasBreakdown = account.productBreakdown && account.productBreakdown.length > 0;

            return (
              <Card key={account.id} className={`transition-all hover:border-primary/20 ${account.health === "champion" ? "border-v-teal/30" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${account.health === "champion" ? "bg-v-teal/10 text-v-teal" : "bg-secondary text-foreground"}`}>
                      {account.health === "champion"
                        ? <Star className="w-4 h-4" />
                        : account.name.slice(0, 2).toUpperCase()
                      }
                    </div>

                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
                      {/* Name & Contact */}
                      <div className="sm:col-span-2 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-foreground truncate">{account.name}</p>
                          {account.isMIA && <Badge variant="danger" className="text-[10px]">MIA</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {account.contactName}
                          {account.contactTitle && account.contactTitle !== "TBD — look up in CRM" && (
                            <span className="text-muted-foreground/60"> · {account.contactTitle}</span>
                          )}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="w-2.5 h-2.5 text-muted-foreground/50" />
                          <span className="text-[10px] text-muted-foreground">{account.country} · {account.vertical}</span>
                        </div>
                      </div>

                      {/* Billing MRR */}
                      <div>
                        <p className="text-xs text-muted-foreground">Billing MRR ({account.revenueHistory[account.revenueHistory.length - 1]?.week ?? ""})</p>
                        <p className="text-sm font-bold text-foreground">{formatCurrency(latestMRR)}</p>
                        <div className="flex items-center gap-1">
                          {mrrChg > 0
                            ? <TrendingUp className="w-3 h-3 text-v-green" />
                            : mrrChg < 0
                            ? <TrendingDown className="w-3 h-3 text-v-red" />
                            : <Minus className="w-3 h-3 text-muted-foreground" />
                          }
                          <span className={`text-[10px] font-medium ${mrrChg > 0 ? "text-v-green" : mrrChg < 0 ? "text-v-red" : "text-muted-foreground"}`}>
                            {mrrChg > 0 ? "+" : ""}{mrrChg}% QoQ
                          </span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={health.variant}>{health.label}</Badge>
                        </div>
                        {account.aiAdoption !== "none" && (
                          <div className="flex items-center gap-1">
                            <BrainCircuit className="w-3 h-3 text-v-blue" />
                            <span className="text-[10px] font-medium text-v-blue">{account.products.length} AI product{account.products.length !== 1 ? "s" : ""}</span>
                          </div>
                        )}
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
                              formatter={(v: any) => [formatCurrency(v as number), "Billing"]}
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

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => navigate(`/outreach?account=${account.id}`)}>
                        Outreach <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* AI products row */}
                  {account.products.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 pl-12">
                      {account.products.map(p => (
                        <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-v-blue/10 text-v-blue font-medium">{p}</span>
                      ))}
                    </div>
                  )}

                  {/* Expand trigger — always visible when there's billing data */}
                  {hasBreakdown && (
                    <button
                      onClick={() => setExpanded(isExpanded ? null : account.id)}
                      className="w-full mt-3 flex items-center justify-between px-3 py-1.5 rounded-lg bg-secondary/40 hover:bg-secondary/70 transition-colors group"
                    >
                      <div className="flex items-center gap-1.5">
                        <Package className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {account.productBreakdown!.filter(p => p.mrr > 0 || (p.quantity ?? 0) > 0).length} products ·{" "}
                          {formatCurrency(account.productBreakdown!.reduce((s, p) => s + (p.mrr > 0 ? p.mrr : 0), 0))} billing
                        </span>
                      </div>
                      {isExpanded
                        ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
                        : <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
                      }
                    </button>
                  )}

                  {/* Expanded product billing breakdown */}
                  {isExpanded && hasBreakdown && (() => {
                    const breakdownTotal = account.productBreakdown!.reduce((s, p) => s + (p.mrr > 0 ? p.mrr : 0), 0);
                    const gap = Math.abs(breakdownTotal - account.mrr);
                    const gapPct = account.mrr > 0 ? gap / account.mrr : 0;
                    const hasGap = gap > 100 && gapPct > 0.03;
                    return (
                    <div className="mt-3 ml-12 rounded-xl border border-border bg-secondary/30 overflow-hidden">
                      <div className="px-4 py-2 border-b border-border bg-secondary/50 flex items-center justify-between">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Product Billing Breakdown — {productMonth}</p>
                        <span className="text-[10px] text-muted-foreground">BigQuery · per-SKU snapshot</span>
                      </div>

                      {/* Header row */}
                      <div className="px-4 py-2 bg-secondary/40 flex items-center text-[10px] font-semibold text-muted-foreground">
                        <div className="flex-1">Product</div>
                        <div className="w-14 text-right">Qty</div>
                        <div className="w-28 text-right">Billings</div>
                        <div className="w-32 text-right">Commissionable</div>
                        <div className="w-16 text-right">Incl. Rate</div>
                      </div>

                      <div className="divide-y divide-border">
                        {account.productBreakdown!
                          .filter(p => p.mrr > 0 || (p.quantity ?? 0) > 0)
                          .map(p => {
                            const inclRate = p.mrr > 0 ? Math.round(p.commissionable / p.mrr * 100) : 0;
                            return (
                              <div key={p.name} className="flex items-center px-4 py-2 text-xs">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-foreground truncate">{p.name}</p>
                                  {p.category && <p className="text-[10px] text-muted-foreground">{p.category}</p>}
                                </div>
                                <div className="w-14 text-right tnum text-muted-foreground">{p.quantity != null ? p.quantity.toLocaleString() : "—"}</div>
                                <div className="w-28 text-right font-semibold tnum">{formatCurrency(p.mrr)}</div>
                                <div className="w-32 text-right font-semibold text-v-teal tnum">{formatCurrency(p.commissionable)}</div>
                                <div className={`w-16 text-right text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  p.mrr === 0 ? "bg-secondary text-muted-foreground"
                                  : inclRate >= 90 ? "bg-v-teal/10 text-v-teal"
                                  : inclRate >= 40 ? "bg-v-amber/10 text-v-amber"
                                  : "bg-v-red/10 text-v-red"
                                }`}>
                                  {p.mrr > 0 ? `${inclRate}%` : "free"}
                                </div>
                              </div>
                            );
                          })
                        }
                      </div>

                      {/* Totals row */}
                      <div className="px-4 py-2 border-t border-border bg-secondary/50 flex items-center text-xs font-semibold">
                        <div className="flex-1">Total</div>
                        <div className="w-14 text-right tnum text-muted-foreground">{account.productBreakdown!.reduce((s, p) => s + (p.quantity ?? 0), 0).toLocaleString()}</div>
                        <div className="w-28 text-right tnum">{formatCurrency(breakdownTotal)}</div>
                        <div className="w-32 text-right text-v-teal tnum">{formatCurrency(account.productBreakdown!.reduce((s, p) => s + p.commissionable, 0))}</div>
                        <div className="w-16"></div>
                      </div>

                      {hasGap && (
                        <div className="px-4 py-2 border-t border-v-amber/30 bg-v-amber/5 flex items-center justify-between text-xs">
                          <span className="text-v-amber font-medium">⚠ Breakdown vs book MRR gap</span>
                          <span className="text-v-amber font-semibold">{formatCurrency(gap)} ({Math.round(gapPct * 100)}%)</span>
                        </div>
                      )}

                      {/* Invoices & credit notes — BigQuery f_billing_tx */}
                      {account.agid && [BILLING_DOCS[account.agid], BILLING_DOCS_MTD[account.agid]]
                        .filter(Boolean)
                        .map(docs => (
                          <div key={docs.month} className="border-t border-border">
                            {/* Section header + summary */}
                            <div className="px-4 py-2.5 border-b border-border bg-secondary/40">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] font-semibold text-foreground">Invoices &amp; Credit Notes</p>
                                <span className="text-[10px] text-muted-foreground">{docs.month}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[11px]">
                                <span className="text-muted-foreground">{docs.invoiceCount} invoice{docs.invoiceCount !== 1 ? "s" : ""}</span>
                                <span className="font-semibold text-foreground tnum">{formatCurrency(docs.billed)} billed</span>
                                {docs.credits < 0 && (
                                  <span className="font-semibold text-v-red tnum">−{formatCurrency(Math.abs(docs.credits))} credited</span>
                                )}
                              </div>
                            </div>

                            {/* Per-invoice rows intentionally omitted — the warehouse invoice id is
                                an internal hash for aggregated invoices (no customer-facing SIN#).
                                The monthly summary above is the useful invoice view. */}

                            {/* Credit notes — number + amount only (real CM# numbers) */}
                            {docs.creditNotes.length > 0 && (
                              <div className="border-t border-v-red/20 bg-v-red/[0.03]">
                                <div className="flex items-center px-4 py-1.5 text-[10px] font-medium uppercase tracking-wide text-v-red/80">
                                  <span className="flex-1">Credit Note #</span>
                                  <span className="w-28 text-right">Amount</span>
                                </div>
                                <div className="divide-y divide-v-red/10">
                                  {docs.creditNotes.map(cn => (
                                    <div key={cn.id} className="flex items-center px-4 py-2 text-xs">
                                      <span className="flex-1 font-mono font-medium text-v-red truncate">{cn.id}</span>
                                      <span className="w-28 text-right font-semibold text-v-red tnum">−{formatCurrency(Math.abs(cn.amount))}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                    );
                  })()}
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
