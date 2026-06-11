import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAM } from "@/context/AMContext";
import { formatCurrency, commissionableMRR } from "@/lib/utils";
import {
  Sparkles, ArrowRight, Zap, Target, Users,
  ChevronDown, ChevronUp, ClipboardPaste, Loader2
} from "lucide-react";

const SAMPLE_BRIEF = `## Vendasta Product Roadmap Update — Week of April 27, 2026

### AI & Automation
- AI Receptionist v3.0 launching May 15: multi-language support (French, Spanish), improved intent detection, CRM sync
- AI Review Responder now supports bulk scheduling and brand tone customization
- New AI Content Writer templates for Home Services and Healthcare verticals

### Platform Updates
- Vendasta CRM: new pipeline view with AI-predicted close probability
- Business App: updated dashboard with AI insights widget
- Reputation Management: competitor benchmarking now live

### GTM Priorities this Quarter
- Focus vertical: Home Services and Legal (highest AI adoption velocity)
- Partner incentive: Double commission on AI Receptionist upgrades through May 31
- New case study available: FastLane Auto Group — 40% increase in lead capture with AI

### Marketing Campaigns Running
- "AI for Small Business" email nurture sequence (April–May)
- Google/LinkedIn ads targeting Home Services SMBs
- Partner webinar: "How to Win with AI" — May 8, 2pm ET`;

interface ActionItem {
  account: string;
  accountId: string;
  commissionable: number;
  action: string;
  product: string;
  urgency: "high" | "medium" | "low";
  rationale: string;
}

function parseBriefToActions(brief: string, accounts: import("@/data/mock").Account[]): ActionItem[] {
  const hasAIReceptionist = brief.toLowerCase().includes("ai receptionist");
  const hasReviewResponder = brief.toLowerCase().includes("review responder");
  const hasContentWriter = brief.toLowerCase().includes("content writer");
  const hasCRM = brief.toLowerCase().includes("crm");
  const hasHomeServices = brief.toLowerCase().includes("home services");
  const hasLegal = brief.toLowerCase().includes("legal");
  const hasDoubleCommission = brief.toLowerCase().includes("double commission") || brief.toLowerCase().includes("incentive");

  const actions: ActionItem[] = [];

  if (hasAIReceptionist) {
    const targets = accounts.filter(a =>
      (a.aiAdoption === "none" || a.aiAdoption === "basic") &&
      ((hasHomeServices ? a.vertical === "Home Services Tech" : true) ||
      (hasLegal ? a.vertical === "Digital Marketing" : false))
    ).slice(0, 3);

    targets.forEach(a => {
      actions.push({
        account: a.name,
        accountId: a.id,
        commissionable: commissionableMRR(a.productBreakdown),
        action: `Pitch AI Receptionist v3.0 upgrade${hasDoubleCommission ? " (double commission incentive expires May 31)" : ""}`,
        product: "AI Receptionist",
        urgency: hasDoubleCommission ? "high" : "medium",
        rationale: `${a.vertical} is a priority vertical this quarter. ${a.name} currently has ${a.aiAdoption === "none" ? "no AI adoption" : "basic AI"} — v3.0 with multi-language and CRM sync is a strong fit.`,
      });
    });
  }

  if (hasReviewResponder) {
    const targets = accounts.filter(a => ["Hospitality Tech", "Automotive Tech", "Healthcare Tech"].includes(a.vertical) && a.aiAdoption !== "power").slice(0, 2);
    targets.forEach(a => {
      actions.push({
        account: a.name,
        accountId: a.id,
        commissionable: commissionableMRR(a.productBreakdown),
        action: "Demo new AI Review Responder bulk scheduling feature",
        product: "AI Review Responder",
        urgency: "medium",
        rationale: `${a.vertical} businesses get high review volume. Bulk scheduling and tone customization directly address their pain.`,
      });
    });
  }

  if (hasContentWriter) {
    const targets = accounts.filter(a => ["Home Services", "Healthcare"].includes(a.vertical) && a.aiAdoption === "none").slice(0, 2);
    targets.forEach(a => {
      actions.push({
        account: a.name,
        accountId: a.id,
        commissionable: commissionableMRR(a.productBreakdown),
        action: "Introduce new AI Content Writer templates for their vertical",
        product: "AI Content Writer",
        urgency: "low",
        rationale: `New vertical-specific templates lower the barrier to entry for AI content adoption in ${a.vertical}.`,
      });
    });
  }

  if (hasCRM) {
    const targets = accounts.filter(a => a.products.includes("CRM Pro")).slice(0, 2);
    targets.forEach(a => {
      actions.push({
        account: a.name,
        accountId: a.id,
        commissionable: commissionableMRR(a.productBreakdown),
        action: "Show new CRM pipeline view with AI close probability scores",
        product: "CRM Pro",
        urgency: "low",
        rationale: `${a.name} is already a CRM Pro customer — this feature upgrade reinforces product value and reduces churn risk.`,
      });
    });
  }

  // Rank by commissionable book value — biggest commission impact first.
  return actions.sort((a, b) => b.commissionable - a.commissionable).slice(0, 8);
}

const urgencyColors = { high: "danger", medium: "warning", low: "info" } as const;

export default function WeeklyBrief() {
  const navigate = useNavigate();
  const { accounts } = useAM();
  const [brief, setBrief] = useState(SAMPLE_BRIEF);
  const [actions, setActions] = useState<ActionItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showBrief, setShowBrief] = useState(false);

  function analyze() {
    setLoading(true);
    setActions(null);
    setTimeout(() => {
      setActions(parseBriefToActions(brief, accounts));
      setLoading(false);
    }, 1200);
  }

  return (
    <div className="animate-fade-in">
      <Header
        title="Weekly Brief"
        subtitle="Paste your R&D & Marketing brief — AI maps it to your book of business"
      />

      <div className="p-6 space-y-5">
        {/* Input */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="flex items-center gap-1.5">
                  <ClipboardPaste className="w-3.5 h-3.5 text-v-blue" />
                  Paste Weekly R&D / Marketing Brief
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Copy from Confluence and paste here. AI will extract product updates and match them to outreach opportunities across your book.
                </p>
              </div>
              <button
                onClick={() => setShowBrief(!showBrief)}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                {showBrief ? <><ChevronUp className="w-3 h-3" /> Hide</> : <><ChevronDown className="w-3 h-3" /> Show brief</>}
              </button>
            </div>
          </CardHeader>
          {showBrief && (
            <CardContent className="pt-0 space-y-3">
              <textarea
                value={brief}
                onChange={e => setBrief(e.target.value)}
                rows={14}
                placeholder="Paste your weekly brief here..."
                className="w-full px-3 py-2.5 text-xs font-mono rounded-lg border border-border bg-secondary/30 focus:outline-none focus:ring-2 focus:ring-ring resize-none leading-relaxed"
              />
            </CardContent>
          )}
          <CardContent className={showBrief ? "pt-0" : ""}>
            <Button onClick={analyze} disabled={loading || !brief.trim()}>
              {loading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
                : <><Sparkles className="w-3.5 h-3.5" /> Generate Action Plan</>
              }
            </Button>
            {!showBrief && brief.trim() && (
              <span className="ml-3 text-xs text-muted-foreground">Sample brief loaded — click Analyze or paste your own</span>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {loading && (
          <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Mapping brief to your book of business...</span>
          </div>
        )}

        {actions && !loading && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-v-purple" />
              <h2 className="text-sm font-semibold text-foreground">
                {actions.length} Account-Aligned Actions Extracted
              </h2>
              <Badge variant="default">{actions.filter(a => a.urgency === "high").length} urgent</Badge>
              <span className="text-xs text-muted-foreground">ranked by commissionable book value · AI products add at 95% inclusion</span>
            </div>

            {/* Highlight: Double Commission */}
            {brief.toLowerCase().includes("double commission") && (
              <div className="p-3.5 rounded-xl bg-v-green/5 border border-v-green/30 flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-v-green mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">💰 Incentive Alert: Double Commission on AI Receptionist</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Offer expires May 31. Prioritize AI Receptionist pitches to No-AI and Basic-AI accounts this week for maximum commission impact.</p>
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              {actions.map((action, idx) => (
                <Card key={idx}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        <Target className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-semibold text-foreground">{action.account}</p>
                          <Badge variant={urgencyColors[action.urgency]}>{action.urgency === "high" ? "Act Now" : action.urgency === "medium" ? "This Week" : "FYI"}</Badge>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-v-blue/10 text-v-blue font-medium">{action.product}</span>
                          <span className="text-xs font-medium text-v-teal">{formatCurrency(action.commissionable)}/mo commissionable</span>
                        </div>
                        <p className="text-sm text-foreground">{action.action}</p>
                        <p className="text-xs text-muted-foreground mt-1">{action.rationale}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/outreach?account=${action.accountId}`)}>
                        Outreach <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Webinar Promo */}
            {brief.toLowerCase().includes("webinar") && (
              <Card className="border-v-teal/30 bg-v-teal/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-v-teal mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Webinar: "How to Win with AI" — May 8, 2pm ET</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Invite your at-risk and MIA accounts. This is a warm re-engagement vehicle — no sales pressure, just value.
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {accounts.filter(a => a.isMIA || a.aiAdoption === "none").map(a => (
                          <span key={a.id} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{a.name}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
