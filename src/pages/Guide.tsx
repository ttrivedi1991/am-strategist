import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, ShieldAlert, Send, FileText, TrendingUp,
  Sparkles, UserSquare2, Database, Lock, ArrowRight, HelpCircle, CheckCircle2,
} from "lucide-react";

// ─── How to use AM Strategist ────────────────────────────────────────────────
// Static in-app knowledge base. Kept dependency-light on purpose so it always
// renders even if live data is unavailable. Facts here mirror CLAUDE.md and the
// RFC (commission basis, MIA rule, health + AI tiers, data source).

type PageDoc = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  to?: string;
  what: string;
  how: string[];
};

const PAGES: PageDoc[] = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    to: "/",
    what: "Your book at a glance — total MRR, quarter-over-quarter (QoQ) change, account-health mix, and the partners that need attention this week.",
    how: [
      "Start here every week. Read the top stat row first: total MRR and QoQ change against the prior-quarter close.",
      "Scan the health breakdown to see how much of the book is at-risk vs healthy.",
      "Click any highlighted partner to jump straight into their Partner Profile.",
    ],
  },
  {
    icon: Users,
    label: "Accounts",
    to: "/accounts",
    what: "The full book of business — every partner you're assigned, filterable and sortable.",
    how: [
      "Use it as the directory: search or sort by MRR, QoQ change, or health.",
      "Switch the active AM (bottom-left) to view a teammate's book.",
      "Click a partner row to open their Partner Profile.",
    ],
  },
  {
    icon: ShieldAlert,
    label: "Top Blockers",
    to: "/mia",
    what: "Partners with an engagement gap — ranked by value — so the highest-stakes re-engagements surface first. Built from real Gmail activity, not a static flag.",
    how: [
      "Work this list top-down: the partners here carry the most MRR and have gone quiet.",
      "The underlying rule of thumb is the 45-day MIA line — no meeting/contact in 45+ days.",
      "From a blocker, jump to Outreach Planner to send a re-engagement.",
    ],
  },
  {
    icon: Send,
    label: "Outreach Planner",
    to: "/outreach",
    what: "Multi-touch outreach sequences with a one-click 'Open in Gmail' so follow-up is fast and consistent.",
    how: [
      "Pick a partner, review the suggested sequence, and open a pre-drafted email in Gmail.",
      "Outreach follows the team writing standards: active voice, lead with the point, reference the existing relationship.",
      "Sign as yourself and edit before sending — the draft is a head start, not a send-as-is.",
    ],
  },
  {
    icon: FileText,
    label: "Weekly Brief",
    to: "/brief",
    what: "Turns the Confluence product/strategy brief into partner-relevant talking points for the week.",
    how: [
      "Paste or load the latest brief; the app highlights what's relevant to your accounts.",
      "Use it to prep talking points before outreach or a QBR.",
    ],
  },
  {
    icon: TrendingUp,
    label: "Commission",
    to: "/commission",
    what: "Your commission outlook — QoQ growth against the finance model. AM-only (not visible to read-only viewers).",
    how: [
      "Track your gap to target through the quarter.",
      "Commission is based on QoQ growth, so the levers are growing existing partners and preventing shrinkage.",
    ],
  },
];

type Concept = { icon: React.ComponentType<{ className?: string }>; term: string; def: string };

const CONCEPTS: Concept[] = [
  { icon: TrendingUp, term: "QoQ (quarter-over-quarter)", def: "Every MRR comparison is quarter-over-quarter, measured against the prior quarter's close — not month-over-month. This is the commission basis." },
  { icon: ShieldAlert, term: "MIA (45-day rule)", def: "A partner is 'MIA' when there's been no meeting or meaningful contact in 45+ days. Top Blockers surfaces these, ranked by value." },
  { icon: CheckCircle2, term: "Account health", def: "Each partner is tiered as champion, healthy, at-risk, or churning, based on MRR trend and engagement." },
  { icon: Sparkles, term: "AI adoption tier", def: "How deeply a partner uses Vendasta's AI products: none, basic, growth, or power. Under-adopters are upsell targets." },
  { icon: Database, term: "Commissionable MRR", def: "The portion of a partner's MRR that counts toward commission — shown alongside total billings so you can see what actually moves your number." },
];

export default function Guide() {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in">
      <Header
        title="Guide"
        subtitle="How to use AM Strategist — pages, workflows, and definitions"
      />

      <div className="p-6 space-y-5 max-w-4xl">
        {/* Intro */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-v-blue" /> What AM Strategist is
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              AM Strategist replaces the weekly manual book-review rebuild. Instead of querying BigQuery
              and rebuilding a spreadsheet by hand, you open one dashboard and read your book: MRR and
              QoQ growth, account health, engagement gaps, outreach, and AI adoption. Everything is driven
              by live Vendasta billing data — so the weekly review is a read, not a rebuild.
            </p>
          </CardContent>
        </Card>

        {/* Quick start */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-v-green" /> Your 15-minute weekly review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {[
                "Open the Dashboard — read total MRR, QoQ change, and the health mix.",
                "Open Top Blockers — work the highest-value quiet partners first.",
                "Open Outreach Planner — send re-engagements from the pre-drafted sequences.",
                "Check Commission — see your gap to target for the quarter.",
              ].map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-foreground">
                  <span className="flex items-center justify-center shrink-0 w-5 h-5 rounded-full bg-v-blue/10 text-v-blue text-xs font-semibold">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Page-by-page */}
        <div>
          <h2 className="text-sm font-semibold text-foreground px-1 mb-2">The pages</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {PAGES.map(({ icon: Icon, label, to, what, how }) => (
              <Card key={label} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-secondary">
                      <Icon className="w-4 h-4 text-v-blue" />
                    </span>
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col flex-1">
                  <p className="text-xs text-muted-foreground leading-relaxed">{what}</p>
                  <ul className="mt-3 space-y-1.5 flex-1">
                    {how.map((h, i) => (
                      <li key={i} className="flex gap-2 text-xs text-foreground/80">
                        <span className="mt-1 w-1 h-1 rounded-full bg-v-teal shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                  {to && (
                    <button
                      onClick={() => navigate(to)}
                      className="mt-3 self-start flex items-center gap-1 text-xs font-medium text-v-blue hover:underline"
                    >
                      Open {label} <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Partner Profile + AI assistant callout */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserSquare2 className="w-4 h-4 text-v-purple" /> Partner Profile &amp; Strategize With Me
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Clicking any partner opens their <strong className="text-foreground">Partner Profile</strong> — the
              partner-centric view that now holds their AI adoption and org-intelligence signals in one place.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Strategize With Me</strong> is the built-in AI assistant. Ask it
              things like &ldquo;Which 3 accounts should I prioritize for a QBR this month?&rdquo; and it answers
              grounded in your live book data.
            </p>
          </CardContent>
        </Card>

        {/* Definitions */}
        <div>
          <h2 className="text-sm font-semibold text-foreground px-1 mb-2">Key definitions</h2>
          <Card>
            <CardContent className="p-0 divide-y divide-border/70">
              {CONCEPTS.map(({ icon: Icon, term, def }) => (
                <div key={term} className="flex gap-3 p-4">
                  <span className="flex items-center justify-center shrink-0 w-7 h-7 rounded-lg bg-secondary">
                    <Icon className="w-4 h-4 text-v-blue" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{term}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{def}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Data + access */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-4 h-4 text-v-teal" /> Where the data comes from
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                All figures come from Vendasta's BigQuery billing warehouse, refreshed through the last
                business day. The &ldquo;Data through&rdquo; badge in the top bar shows the current cutoff.
                Numbers are read-only — AM Strategist never writes back to billing.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-v-amber" /> Access &amp; roles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sign-in is Google, restricted to @vendasta.com and an approved allowlist. Account Managers
                get the full app including Commission; read-only viewers get everything except Commission.
                Need access? Ask Tanmay to add your email.
              </p>
            </CardContent>
          </Card>
        </div>

        <p className="text-[11px] text-muted-foreground text-center pt-1">
          Questions or something out of date? Message Tanmay Trivedi (ttrivedi@vendasta.com).
        </p>
      </div>
    </div>
  );
}
