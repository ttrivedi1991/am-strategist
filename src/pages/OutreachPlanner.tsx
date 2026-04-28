import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ACCOUNTS, ORG_ALERTS } from "@/data/mock";
import { formatDate, daysSince } from "@/lib/utils";
import {
  Send, Mail, Calendar, Sparkles, Copy, CheckCircle2,
  ChevronDown, ChevronRight, Clock, Target, Zap
} from "lucide-react";

interface OutreachStep {
  day: number;
  channel: "email" | "gchat" | "call" | "linkedin";
  action: string;
  subject?: string;
  body?: string;
}

function generateOutreachPlan(accountId: string): { strategy: string; steps: OutreachStep[] } {
  const account = ACCOUNTS.find(a => a.id === accountId);
  if (!account) return { strategy: "", steps: [] };

  const alert = ORG_ALERTS.find(a => a.accountId === accountId);
  const days = daysSince(account.lastMeeting);
  // First name only — handles "Jamie / Brad / Todd" style entries gracefully
  const firstName = account.contactName.split(/[\s/]/)[0].trim();
  const lastMeetingFormatted = new Date(account.lastMeeting).toLocaleDateString("en-US", { month: "long", day: "numeric" });

  // Brendan King sent a "Strategic Discussion: 2026 AI Roadmap" email to all partners on March 20
  const ceoEmailRef = "Brendan's note from March 20";

  let strategyText = "";
  if (account.mrr === 0 || account.health === "churning") {
    strategyText = `Churn recovery. Revenue has collapsed — the goal is a direct conversation about root cause before any product discussion. Don't pitch. Ask questions.`;
  } else if (account.isMIA || days > 45) {
    strategyText = `MIA re-engagement. Last contact was ${days} days ago. Primary goal is booking a meeting — not selling. Reference the existing relationship and use ${ceoEmailRef} as a natural re-entry point.`;
  } else if (account.health === "at-risk") {
    strategyText = `Retention. MRR is declining. Find out if this is product fit, budget, or an internal change at their org — then respond to what you hear, not what you assumed.`;
  } else if (account.health === "champion") {
    strategyText = `Expansion. Account is growing and the contact is engaged. Use this momentum to discuss what's next — ${account.aiAdoption === "none" ? "AI activation is the obvious next conversation" : "product depth or additional use cases"}.`;
  } else {
    strategyText = `Proactive check-in. Account is stable but not growing. Identify one expansion angle tied to their vertical or a product gap in what they're running today.`;
  }

  const email1Body = () => {
    if (account.mrr === 0) {
      return `${firstName},\n\nWanted to connect before too much time passes — your account went to zero and I'd rather understand why than assume.\n\nIs there 20 minutes to talk through what happened?\n\nTanmay`;
    }
    if (account.isMIA || days > 45) {
      const alertLine = alert ? `I also saw the news about ${alert.title.split(":").slice(-1)[0].trim().toLowerCase()} — that adds some urgency to the conversation.` : "";
      return `${firstName},\n\nWe haven't spoken since ${lastMeetingFormatted}. That's longer than I'd like, especially given where things are trending on your account.\n\n${alertLine ? alertLine + "\n\n" : ""}${ceoEmailRef} laid out our 2026 AI roadmap — I want to make sure the parts relevant to ${account.name} don't get lost in the noise. 20 minutes this week?\n\nTanmay`;
    }
    if (account.health === "champion") {
      return `${firstName},\n\nYour account is moving in the right direction and I want to make sure we're intentional about what comes next.\n\n${ceoEmailRef} covered the 2026 roadmap at a high level. There are two or three things in there that map directly to where ${account.name} is heading — worth 20 minutes to go through them?\n\nTanmay`;
    }
    if (alert) {
      return `${firstName},\n\nSaw ${alert.title.split(":").slice(-1)[0].trim().toLowerCase()} and wanted to reach out directly.\n\nWe've been working together long enough that I want to make sure the timing on your end still makes sense. Are you free for a quick call this week?\n\nTanmay`;
    }
    return `${firstName},\n\nFollowing up on ${ceoEmailRef} about our 2026 AI roadmap. Rather than forward the deck, I'd rather walk through what's actually relevant to ${account.name}.\n\nAre you free for 20 minutes this week?\n\nTanmay`;
  };

  const email3Body = () => {
    const productLine = account.products.length > 0
      ? `You're currently running ${account.products.slice(0, 2).join(" and ")}. There's a specific capability that layers on top of that I want to show you.`
      : `There's a capability in the platform that fits your setup well — I want to walk through it specifically.`;
    const verticalLine = account.health === "at-risk"
      ? `Other ${account.vertical} partners who were in a similar position have used it to stabilize and then grow.`
      : `${account.vertical} is one of the verticals where we're seeing the clearest results right now.`;
    return `${firstName},\n\n${productLine}\n\n${verticalLine}\n\n15-minute screen share — no slides, no deck. Just the platform and what it looks like for your account specifically. Happy to fit around your schedule this week or next.\n\nTanmay`;
  };

  const gchatBody = () =>
    `Hey ${firstName} — sent you an email earlier this week. Let me know if it's easier to connect here. Happy to send a calendar invite if that's simpler.`;

  const voicemailBody = () =>
    `Hi ${firstName}, it's Tanmay from Vendasta. I've sent a couple of notes — I have a specific ask I'd rather make on a call than over email. I'll try again in a few days, or feel free to grab time on my calendar. Thanks.`;

  const email5Body = () =>
    `${firstName},\n\nI'll step back on the outreach — I don't want to crowd your inbox if the timing isn't right.\n\nWhen things shift, you know where to find me.\n\nTanmay`;

  const email1Subject = account.mrr === 0
    ? `${account.name} — quick question`
    : (account.isMIA || days > 45)
    ? `Checking in — ${account.name}`
    : alert
    ? `${account.name} — wanted to connect`
    : `2026 roadmap — what's relevant for ${account.name}`;

  return {
    strategy: `${strategyText} Contact: ${account.contactName} (${account.contactTitle}). ${alert ? `Intel signal: ${alert.title}.` : ""}`,
    steps: [
      {
        day: 1,
        channel: "email",
        action: account.isMIA || days > 45 ? "Re-engagement email — direct ask, existing relationship context" : "Proactive email — reference CEO roadmap note as the hook",
        subject: email1Subject,
        body: email1Body(),
      },
      {
        day: 3,
        channel: "gchat",
        action: "GChat nudge if no reply",
        body: gchatBody(),
      },
      {
        day: 6,
        channel: "email",
        action: "Product-specific email — tied to their current stack and vertical",
        subject: `${account.vertical} partners + what's changed in Q2`,
        body: email3Body(),
      },
      {
        day: 10,
        channel: "call",
        action: "Direct call — voicemail script if no answer",
        body: voicemailBody(),
      },
      {
        day: 18,
        channel: "email",
        action: "Close the loop — no pressure, leave the door open",
        subject: `Re: ${account.name}`,
        body: email5Body(),
      },
    ],
  };
}

const CHANNEL_ICONS = { email: Mail, gchat: Zap, call: Clock, linkedin: Target };
const CHANNEL_COLORS = { email: "text-v-blue", gchat: "text-v-green", call: "text-v-amber", linkedin: "text-v-teal" };
const CHANNEL_LABELS = { email: "Email", gchat: "GChat", call: "Phone Call", linkedin: "LinkedIn" };

export default function OutreachPlanner() {
  const [params] = useSearchParams();
  const defaultAccountId = params.get("account") || ACCOUNTS[0].id;
  const [selectedId, setSelectedId] = useState(defaultAccountId);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number>(0);

  const account = ACCOUNTS.find(a => a.id === selectedId) || ACCOUNTS[0];
  const plan = generateOutreachPlan(account.id);
  const alert = ORG_ALERTS.find(a => a.accountId === account.id);

  function copyBody(text: string, idx: number) {
    navigator.clipboard.writeText(text || "").then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  }

  return (
    <div className="animate-fade-in">
      <Header title="Outreach Planner" subtitle="Multi-touch sequences built around existing relationships and current account context" />

      <div className="p-6">
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Account Selector */}
          <div className="lg:w-64 shrink-0 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground px-1 mb-2">SELECT ACCOUNT</p>
            {ACCOUNTS.map(a => (
              <button
                key={a.id}
                onClick={() => { setSelectedId(a.id); setExpanded(0); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${selectedId === a.id ? "border-primary bg-primary/5" : "border-transparent hover:border-border hover:bg-secondary/50"}`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground shrink-0">
                    {a.name.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{a.name}</p>
                    <p className="text-[10px] text-muted-foreground">{a.contactName}</p>
                  </div>
                  {a.isMIA && <Badge variant="danger" className="text-[9px] ml-auto shrink-0">MIA</Badge>}
                </div>
              </button>
            ))}
          </div>

          {/* Plan */}
          <div className="flex-1 space-y-4">
            {/* Account Header */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-sm font-bold text-foreground shrink-0">
                    {account.name.slice(0, 2)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-foreground">{account.name}</p>
                      {account.isMIA && <Badge variant="danger">MIA</Badge>}
                      {alert && <Badge variant="warning">Signal: {alert.type}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{account.contactName} · {account.contactTitle} · {account.vertical}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Last meeting: {formatDate(account.lastMeeting)} ({daysSince(account.lastMeeting)} days ago)</p>
                  </div>
                </div>

                {alert && (
                  <div className="mt-3 p-3 rounded-lg bg-v-amber/5 border border-v-amber/20">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Intelligence Trigger
                    </div>
                    <p className="text-xs text-foreground">{alert.title} — {alert.actionSuggestion}</p>
                  </div>
                )}

                <div className="mt-3 p-3 rounded-lg bg-v-purple/5 border border-v-purple/20">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-v-purple mb-0.5">
                    <Target className="w-3.5 h-3.5" />
                    Strategy
                  </div>
                  <p className="text-xs text-foreground">{plan.strategy}</p>
                </div>
              </CardContent>
            </Card>

            {/* Steps */}
            <div className="space-y-2">
              {plan.steps.map((step, idx) => {
                const Icon = CHANNEL_ICONS[step.channel];
                const color = CHANNEL_COLORS[step.channel];
                const isOpen = expanded === idx;

                return (
                  <Card key={idx} className={`transition-all ${isOpen ? "border-primary/30" : ""}`}>
                    <button
                      className="w-full text-left p-4"
                      onClick={() => setExpanded(isOpen ? -1 : idx)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full border-2 border-current flex items-center justify-center shrink-0 ${color}`}>
                          <span className="text-[10px] font-bold">{idx + 1}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Icon className={`w-3.5 h-3.5 ${color} shrink-0`} />
                          <span className="text-xs font-semibold text-foreground">Day {step.day}</span>
                          <Badge variant="outline" className="text-[10px]">{CHANNEL_LABELS[step.channel]}</Badge>
                          <span className="text-xs text-muted-foreground truncate">{step.action}</span>
                        </div>
                        {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 space-y-3 animate-fade-in">
                        {step.subject && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Subject Line</p>
                            <p className="text-sm font-medium text-foreground bg-secondary/50 px-3 py-2 rounded-lg">{step.subject}</p>
                          </div>
                        )}
                        {step.body && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Message</p>
                            <pre className="text-xs text-foreground bg-secondary/50 px-3 py-2.5 rounded-lg whitespace-pre-wrap font-sans leading-relaxed">{step.body}</pre>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyBody(step.body || "", idx)}
                          >
                            {copiedIdx === idx ? <><CheckCircle2 className="w-3.5 h-3.5 text-v-green" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                          </Button>
                          {step.channel === "email" && (
                            <Button size="sm" onClick={() => window.open(`mailto:${account.contactEmail}?subject=${encodeURIComponent(step.subject || "")}&body=${encodeURIComponent(step.body || "")}`)}>
                              <Mail className="w-3.5 h-3.5" /> Open in Gmail
                            </Button>
                          )}
                          {step.channel === "gchat" && (
                            <Button size="sm" variant="success">
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
