import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useAM } from "@/context/AMContext";
import {
  Send, Mail, Calendar, Sparkles, Copy, CheckCircle2,
  ChevronDown, ChevronRight, Clock, Users
} from "lucide-react";

interface OutreachStep {
  day: number;
  channel: "email" | "gchat" | "call" | "linkedin";
  subject?: string;
  body?: string;
  action: string;
}

const SEQUENCE: OutreachStep[] = [
  { 
    day: 1, 
    channel: "gchat", 
    action: "Internal Check-in",
    body: "Hey [Contact], I noticed your MRR dropped slightly in the April billing run. Wanted to check in and see if that's a contract change or if there's anything I can help with on my end?"
  },
  { 
    day: 3, 
    channel: "email", 
    action: "Value-Forward Outreach",
    subject: "Strategic Update: [Vertical] AI Benchmarks",
    body: "Hi [Name],\n\nI was looking at the latest performance data for [Account] and noticed a great trend in your review response rate. However, I think we have an opportunity to automate this further using the new AI Review Responder templates we just launched.\n\nAre you free for 10 minutes on Thursday to walk through how this could save your team ~5 hours a week?\n\nBest,\nTanmay"
  },
  { 
    day: 7, 
    channel: "call", 
    action: "Executive Save Call",
  },
  { 
    day: 10, 
    channel: "email", 
    action: "Follow-up / Roadmap Sync",
    subject: "Following up: AI Roadmap for [Account]",
    body: "Hi [Name],\n\nJust following up on my previous note. With the Q2 roadmap now finalized, I'd love to align our priorities with your growth goals for the next 90 days.\n\nTalk soon,\nTanmay"
  }
];

export default function OutreachPlanner() {
  const [searchParams] = useSearchParams();
  const { accounts } = useAM();
  const accountId = searchParams.get("accountId");
  const account = accounts.find(a => a.id === accountId) || accounts[0];
  
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
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">MRR (Apr)</p>
                  <p className="text-sm font-bold text-foreground">{formatCurrency(account.mrr)}</p>
                </div>
                <div className="p-2 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Health</p>
                  <Badge variant={account.health === "healthy" || account.health === "champion" ? "success" : account.health === "at-risk" ? "warning" : "danger"}>
                    {account.health}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">Current Products</p>
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

          <Card className="border-v-blue/20 bg-v-blue/5">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-v-blue" />
                <h3 className="text-sm font-semibold text-foreground">AI Strategy Tip</h3>
              </div>
              <p className="text-xs text-foreground leading-relaxed">
                {account.health === "churning" || account.health === "at-risk" 
                  ? "Focus on stability first. Reference the recent billing drop and ask for a 'health check' meeting rather than pitching new products."
                  : account.aiAdoption === "none"
                  ? "This account is a prime candidate for the AI Receptionist v3.0 pilot. Use the multi-language support as a hook."
                  : "Champion account — ask for a referral to another department or business unit during your next sync."}
              </p>
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
              {SEQUENCE.map((step, idx) => {
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
                           step.channel === "call" ? <Phone className="w-4 h-4" /> : <Users className="w-4 h-4" />}
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
                              <p className="text-sm text-foreground">{step.subject.replace("[Account]", account.name).replace("[Vertical]", account.vertical)}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight mb-1">Message Body</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                              {step.body
                                .replace("[Name]", account.contactName.split(" ")[0])
                                .replace("[Account]", account.name)
                                .replace("[Contact]", account.contactName.split(" ")[0])
                                .replace("[Vertical]", account.vertical)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          <Button size="sm" variant="outline" onClick={() => copyToClipboard(step.body || "", idx)}>
                            {copiedIdx === idx ? <><CheckCircle2 className="w-3.5 h-3.5 text-v-green" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                          </Button>
                          {step.channel === "email" && (
                            <Button size="sm" onClick={() => window.open(`mailto:${account.contactEmail}?subject=${encodeURIComponent(step.subject?.replace("[Account]", account.name).replace("[Vertical]", account.vertical) || "")}&body=${encodeURIComponent(step.body?.replace("[Name]", account.contactName.split(" ")[0]).replace("[Account]", account.name).replace("[Contact]", account.contactName.split(" ")[0]).replace("[Vertical]", account.vertical) || "")}`)}>
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

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}

function Phone(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
