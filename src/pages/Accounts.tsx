// Accounts — the centralized partner hub (Bryan's Jul 16 feedback):
// a true table with a sticky header and comparable data points, not stacked
// cards. Row click opens the Partner Profile; the products cell pops a modal
// instead of expanding the page.
import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Account } from "@/data/types";
import { formatCurrency, formatMonthLabel, getLatestMRR } from "@/lib/utils";
import { quarterDelta, QTR } from "@/lib/insights";
import { useNavigate } from "react-router-dom";
import { useAM } from "@/context/AMContext";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { Search, ArrowRight, X, BrainCircuit } from "lucide-react";

const healthBadge: Record<Account["health"], { variant: "success" | "warning" | "danger" | "info"; label: string }> = {
  champion: { variant: "success", label: "Champion" },
  healthy:  { variant: "info",    label: "Healthy"   },
  "at-risk":{ variant: "warning", label: "At Risk"   },
  churning: { variant: "danger",  label: "Churning"  },
};

function commissionableFor(acc: Account) {
  return acc.productBreakdown.reduce((s, p) => s + (p.mrr > 0 ? p.commissionable : 0), 0);
}

// ─── Product-mix modal ─────────────────────────────────────────────────────────

function ProductModal({ account, month, onClose }: { account: Account; month: string; onClose: () => void }) {
  const lines = account.productBreakdown.filter(p => p.mrr > 0 || (p.quantity ?? 0) > 0);
  const total = lines.reduce((s, p) => s + (p.mrr > 0 ? p.mrr : 0), 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl border border-border bg-background shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div>
            <p className="text-sm font-bold text-foreground">{account.name} — Product Mix</p>
            <p className="text-[10px] text-muted-foreground">{month} · BigQuery per-SKU snapshot</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-secondary/90 backdrop-blur">
              <tr className="text-left text-[10px] text-muted-foreground uppercase tracking-wide">
                <th className="px-5 py-2 font-semibold">Product</th>
                <th className="px-3 py-2 font-semibold text-right">Qty</th>
                <th className="px-3 py-2 font-semibold text-right">Billings</th>
                <th className="px-5 py-2 font-semibold text-right">Commissionable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map(p => (
                <tr key={p.name}>
                  <td className="px-5 py-2">
                    <span className="font-medium text-foreground">{p.name.trim()}</span>
                    <span className="text-muted-foreground"> · {p.category}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{p.quantity != null ? p.quantity.toLocaleString() : "—"}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(p.mrr)}</td>
                  <td className="px-5 py-2 text-right font-semibold text-v-teal">{formatCurrency(p.commissionable)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-secondary/90 backdrop-blur">
              <tr className="text-xs font-bold">
                <td className="px-5 py-2">Total</td>
                <td />
                <td className="px-3 py-2 text-right">{formatCurrency(total)}</td>
                <td className="px-5 py-2 text-right text-v-teal">{formatCurrency(commissionableFor(account))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function Accounts() {
  const navigate = useNavigate();
  const { accounts, liveMeta } = useAM();
  const productMonth = liveMeta?.productMonth ? formatMonthLabel(liveMeta.productMonth) : "latest month";
  const [search, setSearch] = useState("");
  const [filterHealth, setFilterHealth] = useState("all");
  const [filterVertical, setFilterVertical] = useState("all");
  const [sortBy, setSortBy] = useState<"mrr" | "qoq" | "health">("mrr");
  const [modalAccount, setModalAccount] = useState<Account | null>(null);

  const verticals = [...new Set(accounts.map(a => a.vertical))].sort();

  const filtered = accounts
    .filter(a => {
      const q = search.toLowerCase();
      return (
        (a.name.toLowerCase().includes(q) || a.contactName.toLowerCase().includes(q) || a.internalId.toLowerCase().includes(q)) &&
        (filterHealth === "all" || a.health === filterHealth) &&
        (filterVertical === "all" || a.vertical === filterVertical)
      );
    })
    .sort((a, b) => {
      if (sortBy === "mrr") return getLatestMRR(b.revenueHistory) - getLatestMRR(a.revenueHistory);
      if (sortBy === "qoq") return (quarterDelta(a)?.delta ?? 0) - (quarterDelta(b)?.delta ?? 0);
      const order = { churning: 0, "at-risk": 1, healthy: 2, champion: 3 };
      return order[a.health] - order[b.health];
    });

  const activeAccounts = accounts.filter(a => getLatestMRR(a.revenueHistory) > 0);
  const totalMRR = activeAccounts.reduce((s, a) => s + getLatestMRR(a.revenueHistory), 0);

  return (
    <div className="animate-fade-in">
      <Header
        title="Accounts"
        subtitle={`${activeAccounts.length} active partners · ${formatCurrency(totalMRR)} billings · click a row for the full partner profile`}
      />

      <div className="p-4 sm:p-6 space-y-3">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-44">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search partner, contact, or PID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select value={filterHealth} onChange={e => setFilterHealth(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none">
            <option value="all">All Health</option>
            <option value="champion">Champion</option>
            <option value="healthy">Healthy</option>
            <option value="at-risk">At Risk</option>
            <option value="churning">Churning</option>
          </select>
          <select value={filterVertical} onChange={e => setFilterVertical(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none">
            <option value="all">All Verticals</option>
            {verticals.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Sort:</span>
            {([["mrr", "Billings"], ["qoq", `${QTR.label} Δ`], ["health", "Health"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`px-2 py-1 rounded ${sortBy === key ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* The table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-220px)] overflow-y-auto">
            <table className="w-full text-xs min-w-[880px]">
              <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur">
                <tr className="text-left text-[10px] text-muted-foreground uppercase tracking-wide border-b border-border">
                  <th className="px-4 py-2.5 font-semibold">Partner</th>
                  <th className="px-3 py-2.5 font-semibold">PID</th>
                  <th className="px-3 py-2.5 font-semibold">Contact</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Billings ({formatMonthLabel(QTR.to)})</th>
                  <th className="px-3 py-2.5 font-semibold text-right">{QTR.label} Δ</th>
                  <th className="px-3 py-2.5 font-semibold text-center">6-Mo Trend</th>
                  <th className="px-3 py-2.5 font-semibold">Health</th>
                  <th className="px-3 py-2.5 font-semibold text-center">AI</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Products</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(account => {
                  const latest = getLatestMRR(account.revenueHistory);
                  const q = quarterDelta(account);
                  const health = healthBadge[account.health];
                  const lineCount = account.productBreakdown.filter(p => p.mrr > 0).length;
                  const trend = account.revenueHistory.slice(-6);
                  const up = (q?.delta ?? 0) >= 0;
                  return (
                    <tr
                      key={account.id}
                      onClick={() => navigate(`/partner/${account.id}`)}
                      className="cursor-pointer hover:bg-secondary/40 transition-colors"
                    >
                      <td className="px-4 py-2 font-semibold text-foreground max-w-52">
                        <span className="truncate block">{account.name}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">{account.vertical}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{account.internalId}</td>
                      <td className="px-3 py-2 text-muted-foreground max-w-36"><span className="truncate block">{account.contactName}</span></td>
                      <td className="px-3 py-2 text-right font-bold text-foreground">{formatCurrency(latest)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${!q || q.delta === 0 ? "text-muted-foreground" : q.delta > 0 ? "text-v-green" : "text-v-red"}`}>
                        {q ? `${q.delta < 0 ? "−" : "+"}${formatCurrency(Math.abs(q.delta))}` : "—"}
                      </td>
                      <td className="px-3 py-1 w-28">
                        <div className="h-8 w-24 mx-auto">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trend} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                              <Area type="monotone" dataKey="mrr" stroke={up ? "#00B67A" : "#EF4444"} strokeWidth={1.5} fill="transparent" dot={false} isAnimationActive={false} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </td>
                      <td className="px-3 py-2"><Badge variant={health.variant} className="text-[10px]">{health.label}</Badge></td>
                      <td className="px-3 py-2 text-center">
                        {account.products.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-v-blue font-semibold">
                            <BrainCircuit className="w-3 h-3" />{account.products.length}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {lineCount > 0 ? (
                          <button
                            onClick={e => { e.stopPropagation(); setModalAccount(account); }}
                            className="px-2 py-0.5 rounded bg-secondary hover:bg-secondary/70 text-foreground font-medium"
                            title="View product mix"
                          >
                            {lineCount} lines
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={e => { e.stopPropagation(); navigate(`/outreach?account=${account.id}`); }}
                        >
                          Outreach <ArrowRight className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No accounts match your filters</p>
          </div>
        )}
      </div>

      {modalAccount && <ProductModal account={modalAccount} month={productMonth} onClose={() => setModalAccount(null)} />}
    </div>
  );
}
