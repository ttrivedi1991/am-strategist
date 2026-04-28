import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, daysSince, formatCurrency } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useAM } from "@/context/AMContext";
import {
  UserX, Clock, TrendingDown, AlertTriangle,
  Mail, Calendar, ArrowRight, Flame, MessageCircle
} from "lucide-react";
import { type Account } from "@/data/mock";

const MIA_THRESHOLD = 45;

function getRiskLevel(account: Account): "critical" | "high" | "medium" {
  const days = daysSince(account.lastMeeting);
  const declining = account.mrr < account.mrrPrev;
  if (days > 80 || account.health === "churning") return "critical";
  if (days > 60 || declining) return "high";
  return "medium";
}

function getReEngagementHook(account: Account): string {
  if (account.health === "churning") {
    return `${account.name} hasn't engaged in ${daysSince(account.lastMeeting)} days and revenue is declining. Send a personal video or executive escalation before they churn.`;
  }
  if (account.vertical === "Healthcare") {
    return `Dr. ${account.contactName.split(" ")[1]} is likely heads-down. Try an async loom or a "3 things I noticed about your reputation this month" email — no ask, just value.`;
  }
  if (account.vertical === "Real Estate") {
    return `New VP of Marketing just joined GreenLeaf. Cold reset — intro email to Nina Patel as a fresh start, not a follow-up.`;
  }
  if (account.vertical === "Fitness") {
    return `Cassandra expressed frustration before going dark. Acknowledge it directly — "I heard your concern and wanted to share what we've done about it."`;
  }
  return `${account.contactName} hasn't responded in ${daysSince(account.lastMeeting)} days. A value-forward email with a specific stat about their account ("your reviews grew X%") tends to cut through.`;
}

function getReEngagementEmail(account: Account): string {
  const firstName = account.contactName.split(" ")[0];
  const days = daysSince(account.lastMeeting);

  if (account.health === "churning") {
    return `Hi ${firstName},\n\nI'll be honest — I haven't heard from you in a while and I'm not sure if something's gone wrong on our end.\n\nI genuinely value ${account.name} as a partner and I want to make sure you're getting value from what we're doing together. Can we get 20 minutes this week? I'd love to hear how things are going and show you what's been working for similar businesses.\n\nNo pitch — just a conversation.\n\nTanvi`;
  }

  return `Hi ${firstName},\n\nIt's been about ${days} days since we last connected, and I wanted to reach out with something I thought you'd actually find useful.\n\nThis month, ${account.name}'s online reviews have continued to come in — and I noticed a few patterns worth discussing. I put together a quick 2-minute overview that I think you'll want to see.\n\nWould you have 15 minutes this week? Happy to work around your schedule.\n\nBest,\nTanvi`;
}

export default function MIARecovery() {
  const navigate = useNavigate();
  const { accounts } = useAM();
  const [expanded, setExpanded] = useState<string | null>(null);

  const miaAccounts = accounts.filter(a => a.isMIA || daysSince(a.lastMeeting) >= MIA_THRESHOLD)
    .sort((a, b) => daysSince(b.lastMeeting) - daysSince(a.lastMeeting));

  const watchlist = accounts.filter(a =>
    !a.isMIA &&
    daysSince(a.lastMeeting) >= 30 &&
    daysSince(a.lastMeeting) < MIA_THRESHOLD
  );

  const totalMRRAtRisk = miaAccounts.reduce((s, a) => s + a.mrr, 0);

  return (
    <div className="animate-fade-in">
      <Header
        title="MIA Recovery"
        subtitle={`${miaAccounts.length} partners gone dark · ${formatCurrency(totalMRRAtRisk)} MRR at risk`}
      />

      <div className="p-6 space-y-6">
        {/* Summary Banner */}
        <div className="p-4 rounded-xl bg-v-red/5 border border-v-red/20 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-v-red mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {miaAccounts.length} partners have had no meeting in {MIA_THRESHOLD}+ days
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              MIA definition: no meeting scheduled or completed in 45 days AND no revenue change (activation or deactivation). These accounts need proactive re-engagement now.
            </p>
          </div>
        </div>

        {/* MIA Accounts */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <UserX className="w-4 h-4 text-v-red" /> Missing In Action
          </h2>
          <div className="space-y-3">
            {miaAccounts.map(account => {
              const days = daysSince(account.lastMeeting);
              const risk = getRiskLevel(account);
              const hook = getReEngagementHook(account);
              const email = getReEngagementEmail(account);
              const isOpen = expanded === account.id;
              const declining = account.mrr < account.mrrPrev;

              return (
                <Card key={account.id} className={`transition-all ${risk === "critical" ? "border-v-red/40" : risk === "high" ? "border-v-amber/40" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 flex-wrap">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                        {account.name.slice(0, 2)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{account.name}</p>
                          <Badge variant={risk === "critical" ? "danger" : risk === "high" ? "warning" : "outline"}>
                            {risk === "critical" ? "Critical" : risk === "high" ? "High Risk" : "Watch"}
                          </Badge>
                          {declining && (
                            <div className="flex items-center gap-1 text-xs text-v-red">
                              <TrendingDown className="w-3 h-3" /> Revenue declining
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{account.contactName} · {account.contactTitle} · {account.vertical}</p>

                        <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span className={days > 60 ? "text-v-red font-medium" : ""}>{days} days since last meeting</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Last met: {formatDate(account.lastMeeting)}
                          </div>
                          <div className="text-xs font-medium text-foreground">
                            MRR: {formatCurrency(account.mrr)}
                          </div>
                        </div>

                        {/* Strategy Hook */}
                        <div className="mt-2.5 p-2.5 rounded-lg bg-v-amber/5 border border-v-amber/20">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-1">
                            <Flame className="w-3 h-3" /> Re-engagement Strategy
                          </div>
                          <p className="text-xs text-foreground">{hook}</p>
                        </div>

                        {isOpen && (
                          <div className="mt-3 space-y-3 animate-fade-in">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Suggested Email Draft</p>
                              <pre className="text-xs text-foreground bg-secondary/50 px-3 py-2.5 rounded-lg whitespace-pre-wrap font-sans leading-relaxed border border-border">{email}</pre>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                size="sm"
                                onClick={() => window.open(`mailto:${account.contactEmail}?subject=Checking in on ${account.name}&body=${encodeURIComponent(email)}`)}
                              >
                                <Mail className="w-3.5 h-3.5" /> Open in Gmail
                              </Button>
                              <Button size="sm" variant="outline">
                                <MessageCircle className="w-3.5 h-3.5" /> GChat
                              </Button>
                              <Button size="sm" variant="outline">
                                <Calendar className="w-3.5 h-3.5" /> Book Meeting
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => navigate(`/outreach?account=${account.id}`)}>
                                Full Sequence <ArrowRight className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setExpanded(isOpen ? null : account.id)}
                        className="text-xs text-primary hover:underline shrink-0 mt-0.5"
                      >
                        {isOpen ? "Collapse" : "View Strategy"}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Watchlist */}
        {watchlist.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-v-amber" /> Approaching MIA (30–44 days)
            </h2>
            <div className="space-y-2">
              {watchlist.map(account => (
                <Card key={account.id} className="border-v-amber/20">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground shrink-0">
                        {account.name.slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{account.name}</p>
                        <p className="text-xs text-muted-foreground">{daysSince(account.lastMeeting)} days · last met {formatDate(account.lastMeeting)}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/outreach?account=${account.id}`)}>
                        Plan <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
