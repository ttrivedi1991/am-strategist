// Top Blockers — what's actually in the way, by theme. Revenue-derived
// blockers (billing declines, corroborated at-risk, AI gaps, org changes)
// plus issues mined from real partner emails (product, platform, customer
// service, billing disputes). Rendered as a clickable word cloud: click a
// theme to expand its blockers. No MIA/engagement category — engagement
// lives on partner profiles via Gmail, not here (removed per Bryan/Tanmay
// feedback: seed meeting dates flagged active partners as missing).
import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, getLatestMRR, recentDeltaMRR, formatMonthLabel } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useAM } from "@/context/AMContext";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, gmailProvider } from "@/lib/firebase";
import { saveGmailToken, loadGmailToken, clearGmailToken, GmailAuthError } from "@/lib/gmail";
import {
  mineEmailIssues, loadCachedIssues, cacheIssues, clearCachedIssues,
  type EmailIssue,
} from "@/lib/emailIssues";
import type { Account, OrgAlert } from "@/data/types";
import {
  TrendingDown, ShieldAlert,
  Mail, BrainCircuit, Zap, ArrowRight,
  Wifi, WifiOff, RefreshCw, Package, Layers, Headphones,
  ChevronDown, ChevronRight as ChevronRightIcon,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type BlockerCategory =
  | "billing" | "ai-adoption" | "at-risk" | "org-change"
  | "product" | "platform" | "service";

interface Blocker {
  id: string;
  category: BlockerCategory;
  account: Account;
  headline: string;
  detail: string;
  mrrAtRisk: number;
  urgency: "high" | "medium" | "low";
  action: string;
  alertId?: string;
}

// ─── Category metadata ─────────────────────────────────────────────────────────

const CATEGORY_META: Record<BlockerCategory, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  border: string;
  leftBorder: string;
}> = {
  billing:       { label: "Billing",          icon: TrendingDown, color: "text-v-amber",  bg: "bg-v-amber/10",  border: "border-v-amber/30",  leftBorder: "border-l-v-amber" },
  product:       { label: "Product Issues",   icon: Package,      color: "text-v-teal",   bg: "bg-v-teal/10",   border: "border-v-teal/30",   leftBorder: "border-l-v-teal" },
  platform:      { label: "Platform Issues",  icon: Layers,       color: "text-v-blue",   bg: "bg-v-blue/10",   border: "border-v-blue/30",   leftBorder: "border-l-v-blue" },
  service:       { label: "Customer Service", icon: Headphones,   color: "text-v-purple", bg: "bg-v-purple/10", border: "border-v-purple/30", leftBorder: "border-l-v-purple" },
  "ai-adoption": { label: "AI Adoption",      icon: BrainCircuit, color: "text-v-blue",   bg: "bg-v-blue/10",   border: "border-v-blue/30",   leftBorder: "border-l-v-blue" },
  "at-risk":     { label: "At Risk",          icon: ShieldAlert,  color: "text-v-red",    bg: "bg-v-red/10",    border: "border-v-red/30",    leftBorder: "border-l-v-red" },
  "org-change":  { label: "Org Change",       icon: Zap,          color: "text-v-purple", bg: "bg-v-purple/10", border: "border-v-purple/30", leftBorder: "border-l-v-purple" },
};

// ─── Blocker derivation ────────────────────────────────────────────────────────

function buildBlockers(
  accounts: Account[],
  orgAlerts: OrgAlert[],
  emailIssues: EmailIssue[]
): Blocker[] {
  const blockers: Blocker[] = [];

  for (const account of accounts) {
    const latestMRR = getLatestMRR(account.revenueHistory);
    const recent = recentDeltaMRR(account.revenueHistory);

    // Billing decline over the last 60 days
    if (recent && recent.delta < -500) {
      blockers.push({
        id: `${account.id}-billing`,
        category: "billing",
        account,
        headline: `Billing down ${formatCurrency(Math.abs(recent.delta))} in 60 days`,
        detail: `${formatMonthLabel(recent.toLabel)}: ${formatCurrency(recent.to)} vs ${formatCurrency(recent.from)} in ${formatMonthLabel(recent.fromLabel)}. Review product mix and usage before the end of the quarter.`,
        mrrAtRisk: Math.abs(recent.delta),
        urgency: recent.delta < -2000 ? "high" : "medium",
        action: "Recovery outreach",
      });
    }

    // AI adoption gap
    if (account.products.length === 0 && latestMRR > 0) {
      blockers.push({
        id: `${account.id}-ai-adoption`,
        category: "ai-adoption",
        account,
        headline: "No AI products active",
        detail: `${formatCurrency(latestMRR)}/mo in billings with zero AI product adoption. ${account.vertical} partners typically see the highest retention lift from Reputation AI Pro or Conversations AI — worth a dedicated conversation.`,
        mrrAtRisk: 0,
        urgency: latestMRR > 5000 ? "high" : "medium",
        action: "AI adoption conversation",
      });
    }

    // At-risk / churning, corroborated by live revenue decline
    if (
      (account.health === "churning" || account.health === "at-risk") &&
      recent && recent.delta < -250 &&
      !blockers.some(b => b.account.id === account.id && b.category === "billing")
    ) {
      blockers.push({
        id: `${account.id}-at-risk`,
        category: "at-risk",
        account,
        headline: account.health === "churning" ? "Partner is churning" : "Partner marked at-risk",
        detail: `Billings ${formatCurrency(recent.to)} in ${formatMonthLabel(recent.toLabel)}, down from ${formatCurrency(recent.from)} in ${formatMonthLabel(recent.fromLabel)}.${account.notes ? ` ${account.notes}` : ""}`,
        mrrAtRisk: latestMRR,
        urgency: account.health === "churning" ? "high" : "medium",
        action: "Save conversation",
      });
    }

    // High-urgency org alerts (top one per account only)
    const topAlert = orgAlerts
      .filter(a => a.accountId === account.id && (a.urgency === "high" || a.urgency === "medium"))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (topAlert) {
      blockers.push({
        id: `${account.id}-org-${topAlert.id}`,
        category: "org-change",
        account,
        headline: topAlert.title,
        detail: `${topAlert.summary}${topAlert.actionSuggestion ? ` — ${topAlert.actionSuggestion}` : ""}`,
        mrrAtRisk: 0,
        urgency: topAlert.urgency as "high" | "medium",
        action: "Respond to change",
        alertId: topAlert.id,
      });
    }
  }

  // Email-mined issues → product / platform / service / billing themes
  for (const issue of emailIssues) {
    const account = accounts.find(a => a.id === issue.accountId);
    if (!account) continue;
    blockers.push({
      id: `${issue.accountId}-email-${issue.theme}-${issue.title.slice(0, 24)}`,
      category: issue.theme,
      account,
      headline: issue.title,
      detail: `${issue.detail} (flagged in email, last 90 days)`,
      mrrAtRisk: 0,
      urgency: "medium",
      action: "Resolve issue",
    });
  }

  return blockers.sort((a, b) => {
    const ord = { high: 0, medium: 1, low: 2 };
    if (ord[a.urgency] !== ord[b.urgency]) return ord[a.urgency] - ord[b.urgency];
    return b.mrrAtRisk - a.mrrAtRisk;
  });
}

// One-sentence narrative per theme — the story behind the count.
function themeNarrative(cat: BlockerCategory, items: Blocker[]): string | null {
  if (items.length === 0) return null;
  const top = [...items].sort((a, b) => b.mrrAtRisk - a.mrrAtRisk).slice(0, 2);
  const names = [...new Set(top.map(b => b.account.name))].join(" and ");
  const total = items.reduce((s, b) => s + b.mrrAtRisk, 0);
  const partners = new Set(items.map(b => b.account.id)).size;
  switch (cat) {
    case "billing":
      return `${items.length} item${items.length > 1 ? "s" : ""}: partners stepped down a combined ${formatCurrency(total)}/mo over the last 60 days — ${names} drive${top.length === 1 ? "s" : ""} most of it.`;
    case "product":
      return `${partners} partner${partners > 1 ? "s" : ""} flagged product problems in email — features not working as expected or missing.`;
    case "platform":
      return `${partners} partner${partners > 1 ? "s" : ""} raised platform issues in email — access, dashboards, data, or integrations.`;
    case "service":
      return `${partners} partner${partners > 1 ? "s" : ""} raised service or fulfillment concerns in email — these erode trust quietly.`;
    case "ai-adoption":
      return `${items.length} partner${items.length > 1 ? "s" : ""} bill real dollars with zero AI products — the cleanest expansion lane, led by ${names}.`;
    case "at-risk":
      return `${items.length} flagged partner${items.length > 1 ? "s" : ""} also show${items.length === 1 ? "s" : ""} live revenue decline — the flag is corroborated, not historical.`;
    case "org-change":
      return `${items.length} partner${items.length > 1 ? "s have" : " has"} verified organizational changes in play — each one is a timing window for outreach.`;
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function TopBlockers() {
  const navigate = useNavigate();
  const { accounts, orgAlerts, geminiApiKey } = useAM();
  const [activeFilter, setActiveFilter] = useState<BlockerCategory | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [gmailToken, setGmailToken] = useState<string | null>(() => loadGmailToken());
  const [issues, setIssues] = useState<EmailIssue[]>(() => loadCachedIssues() ?? []);
  const [mineState, setMineState] = useState<"idle" | "scanning" | "done" | "error">(
    () => (loadCachedIssues() ? "done" : "idle")
  );
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const mineStarted = useRef(false);

  const scanEmails = useCallback(async (token: string) => {
    if (!geminiApiKey) { setGmailError("Gemini key not configured — email mining unavailable."); return; }
    setMineState("scanning");
    setGmailError(null);
    try {
      const found = await mineEmailIssues(token, geminiApiKey, accounts, undefined, (done, total) => setProgress({ done, total }));
      setIssues(found);
      cacheIssues(found);
      setMineState("done");
    } catch (e) {
      if (e instanceof GmailAuthError) {
        setGmailError("Gmail session expired — reconnect below.");
        clearGmailToken();
        setGmailToken(null);
      } else {
        setGmailError("Email scan failed — try again.");
      }
      setMineState("error");
    } finally {
      setProgress(null);
    }
  }, [accounts, geminiApiKey]);

  // Auto-scan once when connected and no fresh cache exists.
  useEffect(() => {
    if (gmailToken && geminiApiKey && accounts.length > 0 && mineState === "idle" && !mineStarted.current) {
      mineStarted.current = true;
      scanEmails(gmailToken);
    }
  }, [gmailToken, geminiApiKey, accounts, mineState, scanEmails]);

  async function connectGmail() {
    setGmailError(null);
    try {
      const result = await signInWithPopup(auth, gmailProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      if (!token) throw new Error();
      saveGmailToken(token);
      setGmailToken(token);
      await scanEmails(token);
    } catch (e: any) {
      if (e?.code !== "auth/popup-closed-by-user") setGmailError("Could not connect Gmail.");
    }
  }

  const blockers = buildBlockers(accounts, orgAlerts, issues);
  const filtered = activeFilter === "all" ? blockers : blockers.filter(b => b.category === activeFilter);

  const categoryCounts = (Object.keys(CATEGORY_META) as BlockerCategory[]).reduce((acc, cat) => {
    acc[cat] = blockers.filter(b => b.category === cat).length;
    return acc;
  }, {} as Record<BlockerCategory, number>);

  const uniquePartners = new Set(blockers.map(b => b.account.id)).size;
  const totalMRRAtRisk = blockers.reduce((s, b) => s + b.mrrAtRisk, 0);
  const maxCount = Math.max(1, ...Object.values(categoryCounts));

  return (
    <div className="animate-fade-in">
      <Header
        title="Top Blockers"
        subtitle={`${blockers.length} blockers across ${uniquePartners} partners · ${formatCurrency(totalMRRAtRisk)} at risk · click a theme to expand`}
      />

      <div className="p-6 space-y-5">

        {/* Gmail strip — powers the email-mined themes */}
        <div className={cn(
          "px-4 py-2.5 rounded-lg border flex items-center gap-3 text-xs",
          gmailToken ? "bg-v-teal/5 border-v-teal/20" : "bg-secondary border-border"
        )}>
          {gmailToken
            ? <Wifi className="w-3.5 h-3.5 text-v-teal shrink-0" />
            : <WifiOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          <span className="flex-1 text-muted-foreground">
            {mineState === "scanning"
              ? `Scanning partner emails for flagged issues…${progress ? ` (${progress.done}/${progress.total} partners)` : ""}`
              : gmailToken
              ? `Gmail connected — product, platform, and service themes come from real partner emails (last 90 days).${issues.length > 0 ? ` ${issues.length} issue${issues.length > 1 ? "s" : ""} found.` : mineState === "done" ? " No issues flagged." : ""}`
              : "Connect Gmail to mine partner emails for product, platform, and service issues."}
            {gmailError && <span className="text-v-red ml-2">{gmailError}</span>}
          </span>
          {gmailToken ? (
            <Button
              size="sm" variant="ghost" className="h-6 text-xs px-2"
              onClick={() => { clearCachedIssues(); scanEmails(gmailToken); }}
              disabled={mineState === "scanning"}
            >
              <RefreshCw className={cn("w-3 h-3 mr-1", mineState === "scanning" && "animate-spin")} /> Rescan
            </Button>
          ) : (
            <Button size="sm" className="h-6 text-xs px-2" onClick={connectGmail}>
              <Mail className="w-3 h-3 mr-1" /> Connect
            </Button>
          )}
        </div>

        {/* Word cloud — themes sized by weight, click to expand */}
        <div className="py-6 px-4 rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-baseline justify-center gap-x-8 gap-y-4">
            {(Object.entries(CATEGORY_META) as [BlockerCategory, (typeof CATEGORY_META)[BlockerCategory]][])
              .filter(([cat]) => categoryCounts[cat] > 0)
              .sort((a, b) => categoryCounts[b[0]] - categoryCounts[a[0]])
              .map(([cat, meta]) => {
                const count = categoryCounts[cat];
                const scale = count / maxCount; // 0..1
                const fontSize = 14 + Math.round(scale * 18); // 14–32px
                const isActive = activeFilter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveFilter(isActive ? "all" : cat)}
                    style={{ fontSize }}
                    className={cn(
                      "font-bold leading-none transition-all hover:scale-105",
                      meta.color,
                      isActive ? "underline underline-offset-4" : "opacity-90 hover:opacity-100"
                    )}
                    title={`${count} blocker${count > 1 ? "s" : ""}`}
                  >
                    {meta.label}
                    <sup className="text-[10px] font-semibold ml-0.5 text-muted-foreground">{count}</sup>
                  </button>
                );
              })}
            {blockers.length === 0 && (
              <p className="text-sm text-muted-foreground">No active blockers. Connect Gmail above to add email-mined coverage.</p>
            )}
          </div>
          {activeFilter !== "all" && (
            <div className="text-center mt-4">
              <button onClick={() => setActiveFilter("all")} className="text-xs text-v-blue hover:underline">
                Show all themes
              </button>
            </div>
          )}
        </div>

        {/* The story behind the counts */}
        {blockers.length > 0 && (
          <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-1.5">
            {(Object.keys(CATEGORY_META) as BlockerCategory[])
              .filter(cat => activeFilter === "all" || activeFilter === cat)
              .map(cat => {
                const narrative = themeNarrative(cat, blockers.filter(b => b.category === cat));
                if (!narrative) return null;
                const meta = CATEGORY_META[cat];
                return (
                  <p key={cat} className="text-xs text-muted-foreground leading-relaxed">
                    <span className={cn("font-bold", meta.color)}>{meta.label}:</span> {narrative}
                  </p>
                );
              })}
          </div>
        )}

        {/* Blocker list */}
        <div className="space-y-2">
          {filtered.length === 0 && blockers.length > 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No blockers in this theme.
            </div>
          )}
          {filtered.map(blocker => {
            const meta = CATEGORY_META[blocker.category];
            const isExpanded = expanded === blocker.id;
            const Icon = meta.icon;

            return (
              <Card
                key={blocker.id}
                className={cn(
                  "transition-all overflow-hidden",
                  blocker.urgency === "high" ? `border-l-4 ${meta.leftBorder}` : ""
                )}
              >
                <button
                  className="w-full text-left"
                  onClick={() => setExpanded(isExpanded ? null : blocker.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", meta.bg)}>
                        <Icon className={cn("w-4 h-4", meta.color)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{blocker.account.name}</span>
                          <Badge
                            variant={blocker.urgency === "high" ? "danger" : "warning"}
                            className="text-[10px]"
                          >
                            {blocker.urgency}
                          </Badge>
                          <span className={cn("text-[10px] font-bold uppercase tracking-wide", meta.color)}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-foreground mt-0.5 leading-snug">{blocker.headline}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {blocker.account.contactName} · {blocker.account.vertical}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {blocker.mrrAtRisk > 0 && (
                          <div className="text-right hidden sm:block">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">at risk</p>
                            <p className="text-sm font-bold text-foreground">{formatCurrency(blocker.mrrAtRisk)}</p>
                          </div>
                        )}
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          : <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </CardContent>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border animate-in fade-in slide-in-from-top-1 duration-150">
                    <p className="text-xs text-muted-foreground leading-relaxed mt-3">{blocker.detail}</p>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => {
                          const params = new URLSearchParams({ account: blocker.account.id });
                          if (blocker.alertId) params.set("intel", blocker.alertId);
                          navigate(`/outreach?${params.toString()}`);
                        }}
                      >
                        {blocker.action} <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/partner/${blocker.account.id}`)}
                      >
                        Partner Profile
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(blocker.account.contactEmail)}`)}
                      >
                        <Mail className="w-3.5 h-3.5" /> Email
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

      </div>
    </div>
  );
}
