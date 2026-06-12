import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, getQoQBaseMRR, commissionableMRR } from "@/lib/utils";
import { useAM } from "@/context/AMContext";
import type { Account } from "@/data/types";
import {
  Send, Mail, Calendar, Copy, CheckCircle2,
  ChevronDown, ChevronRight, Clock, Phone, DollarSign,
  TrendingUp, TrendingDown
} from "lucide-react";

interface OutreachStep {
  day: number;
  channel: "email" | "gchat" | "call" | "linkedin";
  subject?: string;
  body?: string;
  action: string;
}

interface AccountCommissionContext {
  latestLabel: string;
  latestMRR: number;
  qoqBase: number;
  qoqDelta: number;
  commissionable: number;
  effRate: number;
  topProduct?: { name: string; commissionable: number };
}

function getCommissionContext(account: Account): AccountCommissionContext {
  const latest = account.revenueHistory[account.revenueHistory.length - 1];
  const latestMRR = latest?.mrr ?? account.mrr;
  const qoqBase = getQoQBaseMRR(account.revenueHistory);
  const commissionable = commissionableMRR(account.productBreakdown);
  const breakdownBillings = account.productBreakdown.reduce((s, p) => s + (p.mrr > 0 ? p.mrr : 0), 0);
  const topProduct = [...account.productBreakdown]
    .filter(p => p.mrr > 0)
    .sort((a, b) => b.commissionable - a.commissionable)[0];
  return {
    latestLabel: latest?.week ?? "May 26",
    latestMRR,
    qoqBase,
    qoqDelta: latestMRR - qoqBase,
    commissionable,
    effRate: breakdownBillings > 0 ? commissionable / breakdownBillings : 0.95,
    topProduct,
  };
}

// Sequence copy follows anti-ai-writing-style.md: lead with the point, active voice,
// no exclamation points, existing-relationship framing, signed "Tanmay".
function buildSequence(account: Account, ctx: AccountCommissionContext): OutreachStep[] {
  const first = account.contactName.split(" ")[0] || "there";
  const declining = ctx.qoqDelta < 0;
  const aiProducts = account.products;
  const hasAI = aiProducts.length > 0;

  return [
    {
      day: 1,
      channel: "gchat",
      action: declining ? "Billing Check-in" : "Quick Touch-base",
      body: declining
        ? `Hey ${first}, the ${ctx.latestLabel} billing run for ${account.name} came in at ${formatCurrency(ctx.latestMRR)}, down from ${formatCurrency(ctx.qoqBase)} in March. Is that a planned change on your end, or something we should dig into together?`
        : `Hey ${first}, ${account.name}'s ${ctx.latestLabel} billing came in at ${formatCurrency(ctx.latestMRR)}. I have a few ideas from the 2026 AI roadmap that fit where you are — open to a quick call next week?`,
    },
    {
      day: 3,
      channel: "email",
      action: "AI Roadmap Follow-up",
      subject: `2026 AI roadmap — next steps for ${account.name}`,
      body: `Hi ${first},\n\nBrendan's March 20 note on the 2026 AI roadmap laid out where the platform is heading this year. Before we get into specifics, I pulled ${account.name}'s current numbers: ${formatCurrency(ctx.latestMRR)}/mo${ctx.topProduct ? `, with ${ctx.topProduct.name} as your largest line` : ""}.\n\n${hasAI
        ? `You're already running ${aiProducts.join(", ")}. The roadmap items I want to walk through build directly on that.`
        : `You don't have any AI products live yet, which makes this a clean starting point — no migration, no rework.`}\n\nDo you have 20 minutes this week or next?\n\nTanmay`,
    },
    {
      day: 7,
      channel: "call",
      action: declining ? "Executive Save Call" : "Strategy Call",
    },
    {
      day: 10,
      channel: "email",
      action: "Close the Loop",
      subject: `Following up — ${account.name} and the 2026 roadmap`,
      body: `Hi ${first},\n\nFollowing up on my note from last week. The short version: ${declining
        ? `${account.name}'s billing is down ${formatCurrency(Math.abs(ctx.qoqDelta))}/mo since March, and I want to make sure nothing on our end is driving that`
        : `there are roadmap items this quarter that fit ${account.name}, and a 20-minute call beats a long email`}.\n\nIf the timing is off, say so and I'll come back to it in Q3.\n\nTanmay`,
    },
  ];
}

export default function OutreachPlanner() {
  const [searchParams] = useSearchParams();
  const { accounts } = useAM();
  const accountId = searchParams.get("account");
  const account = accounts.find(a => a.id === accountId) || accounts[0];

  const ctx = getCommissionContext(account);
  const sequence = buildSequence(account, ctx);

  const [expandedStep, setExpandedStep] = useState<number | null>(0);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="animate-fade-in">
      <Header
        title="Outreach Planner"
        subtitle={`Multi-touch sequence for ${account.name}`}
      />

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Context */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-lg">
                  {account.name[0]}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{account.name}</h2>
                  <p className="text-xs text-muted-foreground">{account.contactName} · {account.contactTitle}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-2 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Billings ({ctx.latestLabel})</p>
                  <p className="text-sm font-bold text-foreground">{formatCurrency(ctx.latestMRR)}</p>
                </div>
                <div className="p-2 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Commissionable $</p>
                  <p className="text-sm font-bold text-v-teal">{formatCurrency(ctx.commissionable)}</p>
                </div>
                <div className="p-2 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">QoQ (vs Mar close)</p>
                  <p className={cn("text-sm font-bold flex items-center gap-1", ctx.qoqDelta < 0 ? "text-v-red" : "text-v-green")}>
                    {ctx.qoqDelta < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                    {ctx.qoqDelta < 0 ? "−" : "+"}{formatCurrency(Math.abs(ctx.qoqDelta))}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Health</p>
                  <Badge variant={account.health === "healthy" || account.health === "champion" ? "success" : account.health === "at-risk" ? "warning" : "danger"}>
                    {account.health}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">Current AI Products</p>
                <div className="flex flex-wrap gap-1">
                  {account.products.length > 0 ? (
                    account.products.map(p => (
                      <Badge key={p} variant="outline" className="text-[10px] px-1.5 py-0">
                        {p}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">No AI products active</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-v-teal/20 bg-v-teal/5">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-v-teal" />
                <h3 className="text-sm font-semibold text-foreground">Commission Lens</h3>
              </div>
              <ul className="space-y-2 text-xs text-foreground leading-relaxed">
                <li>
                  Effective inclusion rate is {Math.round(ctx.effRate * 100)}% — every $1,000 retained or added here is {formatCurrency(Math.round(ctx.effRate * 1000))} commissionable toward WAMGR.
                </li>
                <li>
                  {ctx.qoqDelta < 0
                    ? `Recovering the ${formatCurrency(Math.abs(ctx.qoqDelta))}/mo QoQ decline restores ${formatCurrency(Math.abs(ctx.qoqDelta) * ctx.effRate)}/mo commissionable.`
                    : `Billings are ${ctx.qoqDelta === 0 ? "flat" : "up"} QoQ. AI products carry a 95% inclusion rate — the highest-value expansion path.`}
                </li>
                {ctx.topProduct && (
                  <li>
                    Largest commissionable line: {ctx.topProduct.name} ({formatCurrency(ctx.topProduct.commissionable)}/mo).
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Sequence Timeline */}
        <div className="lg:col-span-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Recommended Sequence
              </h2>
              <Badge variant="outline">4 touches · 10 days</Badge>
            </div>

            <div className="space-y-3 relative before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-px before:bg-border">
              {sequence.map((step, idx) => {
                const isExpanded = expandedStep === idx;
                return (
                  <Card key={idx} className="relative ml-10 overflow-hidden">
                    <div className="absolute left-[-41px] top-4 w-6 h-6 rounded-full bg-background border-2 border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground z-10">
                      {step.day}
                    </div>

                    <button
                      onClick={() => setExpandedStep(isExpanded ? null : idx)}
                      className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          step.channel === "email" ? "bg-v-blue/10 text-v-blue" :
                          step.channel === "gchat" ? "bg-v-green/10 text-v-green" :
                          step.channel === "call" ? "bg-v-red/10 text-v-red" : "bg-v-purple/10 text-v-purple"
                        )}>
                          {step.channel === "email" ? <Mail className="w-4 h-4" /> :
                           step.channel === "gchat" ? <Send className="w-4 h-4" /> :
                           <Phone className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{step.action}</p>
                          <p className="text-xs text-muted-foreground capitalize">{step.channel} · Day {step.day}</p>
                        </div>
                      </div>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </button>

                    {isExpanded && step.body && (
                      <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="p-3 rounded-lg bg-secondary/50 border border-border space-y-3">
                          {step.subject && (
                            <div className="border-b border-border pb-2">
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Subject</p>
                              <p className="text-sm text-foreground">{step.subject}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight mb-1">Message Body</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                              {step.body}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          <Button size="sm" variant="outline" onClick={() => copyToClipboard(step.body || "", idx)}>
                            {copiedIdx === idx ? <><CheckCircle2 className="w-3.5 h-3.5 text-v-green" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                          </Button>
                          {step.channel === "email" && (
                            <Button size="sm" onClick={() => window.open(`mailto:${account.contactEmail}?subject=${encodeURIComponent(step.subject || "")}&body=${encodeURIComponent(step.body || "")}`)}>
                              <Mail className="w-3.5 h-3.5" /> Open in Gmail
                            </Button>
                          )}
                          {step.channel === "gchat" && (
                            <Button size="sm">
                              <Send className="w-3.5 h-3.5" /> Open GChat
                            </Button>
                          )}
                          {step.channel === "call" && (
                            <Button size="sm" variant="outline">
                              <Calendar className="w-3.5 h-3.5" /> Schedule Call
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
