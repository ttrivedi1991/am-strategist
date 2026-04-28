import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ACCOUNTS, AI_ADOPTION_DATA } from "@/data/mock";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from "recharts";
import { BrainCircuit, ArrowRight, Sparkles, TrendingUp, Zap } from "lucide-react";

const TIER_COLORS = { none: "#e5e7eb", basic: "#00C2CB", growth: "#0055FF", power: "#7C3AED" };
const TIER_LABELS = { none: "No AI", basic: "Basic AI", growth: "Growth AI", power: "Power AI" };

const AI_PRODUCTS = [
  { name: "AI Receptionist", desc: "24/7 AI-powered call answering and lead qualification", fit: ["Home Services", "Legal", "Healthcare", "Automotive"] },
  { name: "AI Chat", desc: "Intelligent website chat that converts visitors to leads", fit: ["Real Estate", "Restaurants", "Fitness", "Financial Services"] },
  { name: "AI Review Responder", desc: "Auto-generate brand-safe responses to reviews at scale", fit: ["Restaurants", "Automotive", "Healthcare", "Fitness"] },
  { name: "AI Content Writer", desc: "Social and blog content generated from business context", fit: ["Real Estate", "Financial Services", "Legal", "Healthcare"] },
];

const OUTREACH_BY_VERTICAL: Record<string, { subject: string; hook: string; cta: string }> = {
  "Home Services": {
    subject: "How Sunrise Plumbing handles calls while your team is on the job",
    hook: "Service businesses miss 40% of calls when crews are on-site. AI Receptionist captures every lead automatically.",
    cta: "Book a 20-min demo to see it live",
  },
  "Healthcare": {
    subject: "Free up your front desk — AI handles appointment inquiries 24/7",
    hook: "Patients call after hours. AI Chat answers, books, and routes — so your staff focuses on care.",
    cta: "See how Pinnacle Dental reduced no-shows by 22%",
  },
  "Legal": {
    subject: "Your competitors are already using AI to capture after-hours leads",
    hook: "65% of legal inquiries happen outside business hours. AI Receptionist ensures you never miss a potential client.",
    cta: "Let's talk about your intake workflow",
  },
  "Real Estate": {
    subject: "AI tools that help your team work smarter, not harder",
    hook: "AI Chat qualifies buyers and sellers 24/7, so your agents spend time closing, not answering basic questions.",
    cta: "Quick 15-minute walkthrough?",
  },
  "Automotive": {
    subject: "How FastLane cut response time to leads from 6 hours to 4 minutes",
    hook: "Car shoppers move fast. AI Receptionist responds instantly and books test drives while competitors sleep.",
    cta: "See the FastLane case study",
  },
  "Fitness": {
    subject: "Turn website visitors into members — automatically",
    hook: "Most gym inquiries never get a callback. AI Chat follows up instantly with a trial offer and booking link.",
    cta: "Free trial — no credit card needed",
  },
  "Restaurants": {
    subject: "Your reviews are your most powerful marketing asset — are you responding to all of them?",
    hook: "AI Review Responder crafts brand-perfect replies in seconds, for every review, every day.",
    cta: "See a demo with your actual reviews",
  },
  "Financial Services": {
    subject: "Trusted advisors are using AI to stay top of mind at scale",
    hook: "AI-drafted content keeps your firm visible between meetings — compliant, consistent, and personal.",
    cta: "Schedule a compliance-friendly demo",
  },
};

export default function AIAdoption() {
  const navigate = useNavigate();
  const [selectedVertical, setSelectedVertical] = useState<string | null>(null);

  const tierCounts = ACCOUNTS.reduce((acc, a) => {
    acc[a.aiAdoption] = (acc[a.aiAdoption] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(tierCounts).map(([tier, count]) => ({
    name: TIER_LABELS[tier as keyof typeof TIER_LABELS],
    value: count,
    color: TIER_COLORS[tier as keyof typeof TIER_COLORS],
  }));

  const noAiAccounts = ACCOUNTS.filter(a => a.aiAdoption === "none");
  const basicAccounts = ACCOUNTS.filter(a => a.aiAdoption === "basic");
  const verticals = [...new Set(ACCOUNTS.filter(a => a.aiAdoption === "none" || a.aiAdoption === "basic").map(a => a.vertical))];

  const targets = selectedVertical
    ? ACCOUNTS.filter(a => a.vertical === selectedVertical && (a.aiAdoption === "none" || a.aiAdoption === "basic"))
    : [...noAiAccounts, ...basicAccounts];

  return (
    <div className="animate-fade-in">
      <Header
        title="AI Adoption"
        subtitle="Track AI solutions penetration and generate strategic outreach"
      />

      <div className="p-6 space-y-6">
        {/* Summary Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(TIER_COLORS).map(([tier, color]) => (
            <div key={tier} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                <span className="text-xs font-medium text-muted-foreground">{TIER_LABELS[tier as keyof typeof TIER_LABELS]}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{tierCounts[tier] || 0}</p>
              <p className="text-xs text-muted-foreground">accounts</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Adoption Trend Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Adoption Trend — Oct 2025 to Apr 2026</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={AI_ADOPTION_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
                  <Bar dataKey="none" stackId="a" fill={TIER_COLORS.none} name="No AI" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="basic" stackId="a" fill={TIER_COLORS.basic} name="Basic" />
                  <Bar dataKey="growth" stackId="a" fill={TIER_COLORS.growth} name="Growth" />
                  <Bar dataKey="power" stackId="a" fill={TIER_COLORS.power} name="Power" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                {Object.entries(TIER_COLORS).map(([tier, color]) => (
                  <div key={tier} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                    <span className="text-xs text-muted-foreground">{TIER_LABELS[tier as keyof typeof TIER_LABELS]}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pie */}
          <Card>
            <CardHeader>
              <CardTitle>Current Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, name) => [v, name]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </div>
                    <span className="font-medium">{d.value} ({Math.round((d.value / ACCOUNTS.length) * 100)}%)</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Strategic Outreach Generator */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-v-purple" />
                  AI Outreach Generator
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {noAiAccounts.length + basicAccounts.length} accounts are candidates for AI upsell · Filter by vertical to generate targeted outreach
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedVertical || "all"}
                  onChange={e => setSelectedVertical(e.target.value === "all" ? null : e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none"
                >
                  <option value="all">All Verticals</option>
                  {verticals.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {targets.map(account => {
              const outreach = OUTREACH_BY_VERTICAL[account.vertical];
              return (
                <div key={account.id} className="p-4 rounded-xl border border-border bg-secondary/30 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{account.name}</p>
                        <Badge variant={account.aiAdoption === "none" ? "outline" : "info"}>
                          {TIER_LABELS[account.aiAdoption]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{account.vertical}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Decision maker: {account.contactName} · {account.contactTitle}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/outreach?account=${account.id}`)}>
                        Full Plan <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-background rounded-lg p-3 border border-border space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-v-purple">
                      <BrainCircuit className="w-3.5 h-3.5" />
                      AI-Recommended Outreach
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Subject: </span>
                      <span className="text-xs text-foreground">{outreach.subject}</span>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Hook: </span>
                      <span className="text-xs text-foreground">{outreach.hook}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-v-blue font-medium">
                      <Zap className="w-3 h-3" />
                      CTA: {outreach.cta}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {AI_PRODUCTS
                      .filter(p => p.fit.includes(account.vertical))
                      .map(p => (
                        <div key={p.name} className="flex items-center gap-1 px-2 py-1 rounded-full bg-v-purple/10 text-v-purple text-[10px] font-medium">
                          <TrendingUp className="w-2.5 h-2.5" />
                          {p.name}
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
