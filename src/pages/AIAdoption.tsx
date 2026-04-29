import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AI_ADOPTION_DATA } from "@/data/mock";
import { useNavigate } from "react-router-dom";
import { useAM } from "@/context/AMContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie
} from "recharts";
import { BrainCircuit, ArrowRight, Sparkles, TrendingUp, Zap, CheckCircle2 } from "lucide-react";

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
  "Digital Marketing": {
    subject: "The agencies growing fastest right now have one thing in common",
    hook: "AI-powered fulfillment lets your team deliver more campaigns at higher margin — without adding headcount.",
    cta: "15-minute call to walk through the ROI model",
  },
  "Agency": {
    subject: "How top agencies are using AI to scale without scaling costs",
    hook: "AI content and automation tools let agencies take on more clients with the same team. The margin impact is significant.",
    cta: "Want to see how it maps to your current offering?",
  },
  "AI / SaaS": {
    subject: "You're already AI-forward — here's what your SMB clients are missing",
    hook: "Your end customers need AI tools they can actually use. Vendasta's white-label AI suite gives them that under your brand.",
    cta: "Quick walkthrough of what partners are packaging",
  },
  "Automotive Tech": {
    subject: "Dealers using AI are converting 30% more service leads — here's how",
    hook: "AI Receptionist and review automation are the two highest-ROI tools for automotive right now. Both work out of the box.",
    cta: "Book a demo focused on your dealer network",
  },
  "Telecom": {
    subject: "Your SMB customers are asking for AI — do you have an answer?",
    hook: "Telecom partners adding AI to their SMB bundles are seeing stronger retention and higher ARPU. The demand is already there.",
    cta: "Let's talk about bundling strategy",
  },
  "Domain & Hosting": {
    subject: "Add AI to your SMB stack — without building anything",
    hook: "Your hosting customers need reputation management and AI content tools. Vendasta's platform adds both to your existing stack.",
    cta: "See what other hosting partners are offering",
  },
  "FinTech": {
    subject: "AI tools that help your SMB clients grow — and stick with you longer",
    hook: "FinTech platforms adding AI-powered marketing to their SMB offering see meaningfully better retention. It's a natural complement.",
    cta: "15 minutes to show you what's working",
  },
  "Hospitality Tech": {
    subject: "AI Review Responder is generating serious ROI for hospitality brands",
    hook: "Hotels and restaurants live and die by reviews. Bulk AI response at scale keeps ratings high without manual effort.",
    cta: "See a demo with real hospitality data",
  },
  "Industry Association": {
    subject: "Give your members an AI advantage — white-labeled under your brand",
    hook: "Associations offering AI tools to members are seeing higher engagement and new revenue. It's a differentiator members notice.",
    cta: "Let's talk about a member-ready rollout",
  },
  "PropTech": {
    subject: "Property managers using AI are filling vacancies faster",
    hook: "AI Chat handles after-hours inquiries and schedules showings automatically — so no lead goes cold overnight.",
    cta: "Quick demo using a property management scenario",
  },
  "Multifamily Tech": {
    subject: "AI that handles leasing inquiries 24/7 — fully automated",
    hook: "Prospective renters don't wait. AI Receptionist responds instantly, qualifies leads, and books tours while your team sleeps.",
    cta: "See it running on a multifamily property",
  },
  "Franchise Tech": {
    subject: "How franchise brands are using AI to maintain consistency across locations",
    hook: "AI Review Responder and Content Writer ensure every location sounds on-brand — without corporate oversight on every post.",
    cta: "15-minute call to see the franchise use case",
  },
  "Healthcare Tech": {
    subject: "Your healthcare clients need AI tools — and they need them to be compliant",
    hook: "Vendasta's AI suite is built for HIPAA-adjacent workflows. Your clients get automation without the compliance headache.",
    cta: "Let's walk through the healthcare module",
  },
  "Home Services Tech": {
    subject: "The home services platforms winning right now are all offering AI",
    hook: "AI Receptionist and lead capture tools are the most-requested add-ons from home services SMBs. Easy to bundle, high margin.",
    cta: "See how other platforms are packaging it",
  },
  "Data & Analytics": {
    subject: "Your SMB clients need AI-powered marketing — you can be the source",
    hook: "Data-driven teams who add AI marketing tools to their offering open a new revenue stream with minimal lift.",
    cta: "Quick call to map it to your current product",
  },
};

const FALLBACK_OUTREACH = {
  subject: "A quick question about your AI roadmap for SMB clients",
  hook: "Partners who've added AI to their SMB offering are seeing stronger retention and new revenue. Worth a conversation.",
  cta: "15-minute call to walk through what's working",
};

export default function AIAdoption() {
  const navigate = useNavigate();
  const { accounts, selectedAM } = useAM();
  const [selectedVertical, setSelectedVertical] = useState<string | null>(null);
  const trendData = AI_ADOPTION_DATA[selectedAM.id] ?? [];

  const tierCounts = accounts.reduce((acc, a) => {
    acc[a.aiAdoption] = (acc[a.aiAdoption] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(tierCounts).map(([tier, count]) => ({
    name: TIER_LABELS[tier as keyof typeof TIER_LABELS],
    value: count,
    color: TIER_COLORS[tier as keyof typeof TIER_COLORS],
  }));

  const noAiAccounts = accounts.filter(a => a.aiAdoption === "none");
  const basicAccounts = accounts.filter(a => a.aiAdoption === "basic");
  const verticals = [...new Set(accounts.filter(a => a.aiAdoption === "none").map(a => a.vertical))].sort();

  const targets = selectedVertical
    ? accounts.filter(a => a.vertical === selectedVertical && a.aiAdoption === "none")
    : noAiAccounts;

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
              <CardTitle>Partners with Active AI Products — Jan to Apr 2026</CardTitle>
              <p className="text-xs text-muted-foreground">Source: BigQuery · billing_reporting &gt; 0 on ai_product_ind = true products</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
                  <Bar dataKey="noAI" stackId="a" fill={TIER_COLORS.none} name="No AI" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="withAI" stackId="a" fill="#0055FF" name="Has AI" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#0055FF" }} />
                  <span className="text-xs text-muted-foreground">Has active AI products</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: TIER_COLORS.none }} />
                  <span className="text-xs text-muted-foreground">No active AI products</span>
                </div>
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
                    <span className="font-medium">{d.value} ({Math.round((d.value / accounts.length) * 100)}%)</span>
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
                  {noAiAccounts.length} accounts have zero active AI products · Source: BigQuery Mar 2026 actuals
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
              const outreach = OUTREACH_BY_VERTICAL[account.vertical] ?? FALLBACK_OUTREACH;
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

                </div>
              );
            })}
            {targets.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">All accounts in this vertical already have active AI products.</p>
            )}
          </CardContent>
        </Card>

        {/* Partners already using AI */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-v-green" />
              Partners with Active AI Products
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {accounts.filter(a => a.aiAdoption !== "none").length} of {accounts.length} partners · Source: BigQuery Mar 2026 actuals
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {accounts
              .filter(a => a.aiAdoption !== "none")
              .sort((a, b) => b.products.length - a.products.length)
              .map(account => (
                <div key={account.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-secondary/20">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{account.name}</span>
                      <Badge variant={account.aiAdoption === "power" ? "default" : account.aiAdoption === "growth" ? "info" : "outline"}>
                        {TIER_LABELS[account.aiAdoption]}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {account.products.map(p => (
                        <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-v-blue/10 text-v-blue font-medium">{p}</span>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/accounts`)}>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
