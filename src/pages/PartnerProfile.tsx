// Partner Profile — the partner-centric hub (Bryan's Jul 16 feedback):
// everything about one partner in one place. Identity + PID, the trend and
// its story, product mix, AI adoption, verified org signals, recommended
// actions, and the last three real conversations.
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAM } from "@/context/AMContext";
import { formatCurrency, formatDate, getLatestMRR, recentDeltaMRR, commissionableMRR, formatMonthLabel } from "@/lib/utils";
import { quarterDelta, sixMonthHistory, trendNarrative, recommendedActions, exact$, QTR } from "@/lib/insights";
import { loadGmailToken, fetchRecentThreads, type RecentThread } from "@/lib/gmail";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowLeft, ArrowRight, Send, Mail, Globe, TrendingUp, TrendingDown,
  BrainCircuit, Zap, ExternalLink, MessageSquare, Flame, Package,
} from "lucide-react";
import type { Account } from "@/data/types";

const healthBadge: Record<Account["health"], { variant: "success" | "warning" | "danger" | "info"; label: string }> = {
  champion: { variant: "success", label: "Champion" },
  healthy: { variant: "info", label: "Healthy" },
  "at-risk": { variant: "warning", label: "At Risk" },
  churning: { variant: "danger", label: "Churning" },
};

const AI_TIER_LABEL: Record<Account["aiAdoption"], string> = {
  none: "No AI products",
  basic: "Basic — first AI product live",
  growth: "Growth — multiple AI products",
  power: "Power user — AI across the stack",
};

export default function PartnerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accounts, orgAlerts } = useAM();
  const account = accounts.find(a => a.id === id);

  const [threads, setThreads] = useState<RecentThread[] | null>(null);
  const [threadsState, setThreadsState] = useState<"loading" | "no-token" | "done" | "error">("loading");

  useEffect(() => {
    if (!account) return;
    const token = loadGmailToken();
    if (!token) { setThreadsState("no-token"); return; }
    fetchRecentThreads(token, account, 3)
      .then(t => { setThreads(t); setThreadsState("done"); })
      .catch(() => setThreadsState("error"));
  }, [account?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!account) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Partner not found. <Link to="/accounts" className="text-v-blue hover:underline">Back to accounts</Link></p>
      </div>
    );
  }

  const latestMRR = getLatestMRR(account.revenueHistory);
  const latestLabel = account.revenueHistory.at(-1)?.week ?? "";
  const q = quarterDelta(account);
  const recent = recentDeltaMRR(account.revenueHistory);
  const commissionable = commissionableMRR(account.productBreakdown);
  const health = healthBadge[account.health];
  const story = trendNarrative(account, orgAlerts);
  const trend = sixMonthHistory(account).map(h => ({ ...h, label: formatMonthLabel(h.week) }));
  const signals = orgAlerts
    .filter(a => a.accountId === account.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const actions = recommendedActions([account], orgAlerts, 3);
  const productLines = [...account.productBreakdown].filter(p => p.mrr > 0).sort((a, b) => b.mrr - a.mrr);
  const trendUp = (recent?.delta ?? 0) >= 0;

  return (
    <div className="animate-fade-in">
      <Header title={account.name} subtitle={`${account.vertical} · ${account.country}`} />

      <div className="p-4 sm:p-6 space-y-4">
        {/* Identity bar */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate("/accounts")} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground" title="Back to accounts">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-foreground">{account.name}</h2>
                <Badge variant={health.variant}>{health.label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                PID {account.internalId}{account.agid ? ` · ${account.agid}` : ""} · {account.contactName}
                {account.contactTitle && account.contactTitle !== "TBD — look up in CRM" ? `, ${account.contactTitle}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {account.website && (
              <Button size="sm" variant="outline" onClick={() => window.open(`https://${account.website}`)}>
                <Globe className="w-3.5 h-3.5" /> {account.website}
              </Button>
            )}
            {account.contactEmail && (
              <Button size="sm" variant="outline" onClick={() => window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(account.contactEmail)}`)}>
                <Mail className="w-3.5 h-3.5" /> Email
              </Button>
            )}
            <Button size="sm" onClick={() => navigate(`/outreach?account=${account.id}`)}>
              <Send className="w-3.5 h-3.5" /> Outreach Plan
            </Button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: `Billings (${formatMonthLabel(latestLabel)})`, value: formatCurrency(latestMRR) },
            {
              label: `${QTR.label} Δ (${formatMonthLabel(QTR.from)}→${formatMonthLabel(QTR.to)})`,
              value: q ? `${q.delta < 0 ? "−" : "+"}${formatCurrency(Math.abs(q.delta))}` : "—",
              tone: q ? (q.delta < 0 ? "down" : "up") : undefined,
            },
            {
              label: "60-Day Δ",
              value: recent ? `${recent.delta < 0 ? "−" : "+"}${formatCurrency(Math.abs(recent.delta))}` : "—",
              tone: recent ? (recent.delta < 0 ? "down" : "up") : undefined,
            },
            { label: "Commissionable", value: formatCurrency(commissionable), tone: "teal" as const },
          ].map(kpi => (
            <div key={kpi.label} className="p-3 rounded-xl border border-border bg-card">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{kpi.label}</p>
              <p className={`text-lg font-bold flex items-center gap-1 ${
                kpi.tone === "down" ? "text-v-red" : kpi.tone === "up" ? "text-v-green" : kpi.tone === "teal" ? "text-v-teal" : "text-foreground"
              }`}>
                {kpi.tone === "down" && <TrendingDown className="w-4 h-4" />}
                {kpi.tone === "up" && <TrendingUp className="w-4 h-4" />}
                {kpi.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: story + trend + products */}
          <div className="lg:col-span-2 space-y-4">
            {/* The story */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-v-blue" /> The Story
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {account.gtmContext && <p className="text-sm text-foreground leading-relaxed">{account.gtmContext}</p>}
                <p className="text-sm text-muted-foreground leading-relaxed">{story}</p>
                {account.notes && <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-2">Notes: {account.notes}</p>}
              </CardContent>
            </Card>

            {/* 6-month trend */}
            <Card>
              <CardHeader>
                <CardTitle>6-Month Billing Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trend} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="profile-trend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={trendUp ? "#00B67A" : "#EF4444"} stopOpacity={0.18} />
                        <stop offset="95%" stopColor={trendUp ? "#00B67A" : "#EF4444"} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCurrency(v)} width={52} />
                    <Tooltip formatter={(v: any) => [exact$(v as number), "Billings"]} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                    <Area type="monotone" dataKey="mrr" stroke={trendUp ? "#00B67A" : "#EF4444"} strokeWidth={2} fill="url(#profile-trend)" dot={{ r: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Product mix */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-muted-foreground" /> What They Buy ({productLines.length} lines)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] text-muted-foreground uppercase tracking-wide border-b border-border">
                        <th className="px-4 py-2 font-semibold">Product</th>
                        <th className="px-4 py-2 font-semibold text-right">Billings</th>
                        <th className="px-4 py-2 font-semibold text-right">Commissionable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {productLines.map(p => (
                        <tr key={p.name}>
                          <td className="px-4 py-2">
                            <span className="font-medium text-foreground">{p.name.trim()}</span>
                            <span className="text-muted-foreground"> · {p.category}</span>
                          </td>
                          <td className="px-4 py-2 text-right font-semibold">{formatCurrency(p.mrr)}</td>
                          <td className="px-4 py-2 text-right font-semibold text-v-teal">{formatCurrency(p.commissionable)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: actions, AI, signals, conversations */}
          <div className="space-y-4">
            {/* Recommended actions */}
            <Card className="border-v-amber/30 bg-v-amber/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-v-amber" /> Recommended Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {actions.length === 0 && <p className="text-xs text-muted-foreground">Nothing urgent — keep the regular cadence.</p>}
                {actions.map(a => (
                  <button
                    key={a.theme}
                    onClick={() => navigate(`/outreach?account=${account.id}${a.alertId ? `&intel=${a.alertId}` : ""}`)}
                    className="w-full text-left p-2.5 rounded-lg bg-background/70 border border-border hover:border-v-amber/50 transition-colors"
                  >
                    <p className="text-xs font-bold text-foreground">{a.theme}</p>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">{a.detail}</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* AI adoption — partner-centric */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <BrainCircuit className="w-3.5 h-3.5 text-v-blue" /> AI Adoption
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs font-semibold text-foreground">{AI_TIER_LABEL[account.aiAdoption]}</p>
                {account.products.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {account.products.map(p => (
                      <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-v-blue/10 text-v-blue font-medium">{p}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    No AI products live. Clean starting point — no migration, and this is the highest-inclusion-rate expansion path (95%).
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Org signals */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-v-amber" /> Signals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {signals.length === 0 && <p className="text-xs text-muted-foreground">No verified public signals for this partner in the current research pass.</p>}
                {signals.map(s => (
                  <div key={s.id} className="p-2.5 rounded-lg bg-secondary/40 border border-border">
                    <div className="flex items-center gap-2">
                      <Badge variant={s.urgency === "high" ? "danger" : s.urgency === "medium" ? "warning" : "outline"} className="text-[10px] capitalize">{s.type.replace("-", " ")}</Badge>
                      <span className="text-[10px] text-muted-foreground">{formatDate(s.date)}</span>
                    </div>
                    <p className="text-xs font-semibold text-foreground mt-1 leading-snug">{s.title}</p>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">{s.actionSuggestion}</p>
                    {s.sourceUrl && (
                      <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-v-blue hover:underline mt-1">
                        <ExternalLink className="w-2.5 h-2.5" /> {s.source}
                      </a>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Last conversations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-v-teal" /> Last Conversations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {threadsState === "loading" && <p className="text-xs text-muted-foreground">Checking Gmail…</p>}
                {threadsState === "no-token" && (
                  <p className="text-xs text-muted-foreground">
                    Connect Gmail on <Link to="/mia" className="text-v-blue hover:underline">Top Blockers</Link> to see the last three email threads with {account.contactName.split(" ")[0]}.
                  </p>
                )}
                {threadsState === "error" && <p className="text-xs text-muted-foreground">Gmail session expired — reconnect on <Link to="/mia" className="text-v-blue hover:underline">Top Blockers</Link>.</p>}
                {threadsState === "done" && threads && threads.length === 0 && (
                  <p className="text-xs text-muted-foreground">No email history found for this partner's contact or domain.</p>
                )}
                {threadsState === "done" && threads?.map(t => (
                  <a
                    key={t.id}
                    href={`https://mail.google.com/mail/u/0/#all/${t.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block p-2.5 rounded-lg bg-secondary/40 border border-border hover:border-v-teal/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground truncate">{t.subject}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(t.date)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{t.snippet}</p>
                  </a>
                ))}
              </CardContent>
            </Card>

            {/* Cross-links */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate(`/outreach?account=${account.id}`)}>
                Outreach Planner <ArrowRight className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate(`/commission`)}>
                Commission View <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
