import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate, daysSince, getQoQBaseMRR } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useAM } from "@/context/AMContext";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, gmailProvider } from "@/lib/firebase";
import { fetchLastEmailDates, saveGmailToken, loadGmailToken, clearGmailToken } from "@/lib/gmail";
import type { Account, OrgAlert } from "@/data/types";
import {
  Clock, TrendingDown, AlertTriangle, ShieldAlert,
  Mail, BrainCircuit, Zap, ArrowRight,
  Wifi, WifiOff, RefreshCw,
  ChevronDown, ChevronRight as ChevronRightIcon,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type BlockerCategory = "engagement" | "billing" | "ai-adoption" | "at-risk" | "org-change";

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
  engagement:    { label: "Engagement",   icon: Clock,        color: "text-v-red",    bg: "bg-v-red/10",    border: "border-v-red/30",    leftBorder: "border-l-v-red" },
  billing:       { label: "Billing",      icon: TrendingDown, color: "text-v-amber",  bg: "bg-v-amber/10",  border: "border-v-amber/30",  leftBorder: "border-l-v-amber" },
  "ai-adoption": { label: "AI Adoption",  icon: BrainCircuit, color: "text-v-blue",   bg: "bg-v-blue/10",   border: "border-v-blue/30",   leftBorder: "border-l-v-blue" },
  "at-risk":     { label: "At Risk",      icon: ShieldAlert,  color: "text-v-red",    bg: "bg-v-red/10",    border: "border-v-red/30",    leftBorder: "border-l-v-red" },
  "org-change":  { label: "Org Change",   icon: Zap,          color: "text-v-purple", bg: "bg-v-purple/10", border: "border-v-purple/30", leftBorder: "border-l-v-purple" },
};

// ─── Gmail helpers (reused from MIA Recovery) ──────────────────────────────────

function effectiveLastContact(account: Account, gmailDates: Record<string, string>): string {
  const email = gmailDates[account.id];
  if (!email) return account.lastMeeting;
  return email > account.lastMeeting ? email : account.lastMeeting;
}

// ─── Blocker derivation ────────────────────────────────────────────────────────

function buildBlockers(
  accounts: Account[],
  orgAlerts: OrgAlert[],
  gmailDates: Record<string, string>
): Blocker[] {
  const blockers: Blocker[] = [];

  for (const account of accounts) {
    const latest = account.revenueHistory[account.revenueHistory.length - 1];
    const latestMRR = latest?.mrr ?? account.mrr;
    const qoqBase = getQoQBaseMRR(account.revenueHistory);
    const qoqDelta = latestMRR - qoqBase;
    const lastContact = effectiveLastContact(account, gmailDates);
    const days = daysSince(lastContact);

    // 1. Engagement gap
    if (days >= 30) {
      blockers.push({
        id: `${account.id}-engagement`,
        category: "engagement",
        account,
        headline: days >= 45
          ? `No contact in ${days} days — MIA`
          : `${days} days since last contact`,
        detail: `Last contact: ${formatDate(lastContact)}. ${days >= 45
          ? "Past MIA threshold — silent churn risk is elevated."
          : "Approaching MIA threshold. A proactive touch now prevents a recovery sequence later."}`,
        mrrAtRisk: account.mrr,
        urgency: days >= 45 ? "high" : "medium",
        action: "Start outreach sequence",
      });
    }

    // 2. Billing decline
    if (qoqDelta < -500) {
      blockers.push({
        id: `${account.id}-billing`,
        category: "billing",
        account,
        headline: `Billing down ${formatCurrency(Math.abs(qoqDelta))} QoQ`,
        detail: `${latest?.week ?? "Latest"}: ${formatCurrency(latestMRR)} vs ${formatCurrency(qoqBase)} at Mar 2026 close. ${account.notes ? account.notes : "Review product mix and usage before the end of the quarter."}`,
        mrrAtRisk: Math.abs(qoqDelta),
        urgency: qoqDelta < -2000 ? "high" : "medium",
        action: "Recovery outreach",
      });
    }

    // 3. AI adoption gap
    if (account.products.length === 0 && account.mrr > 0) {
      blockers.push({
        id: `${account.id}-ai-adoption`,
        category: "ai-adoption",
        account,
        headline: "No AI products active",
        detail: `${formatCurrency(account.mrr)}/mo in billings with zero AI product adoption. ${account.vertical} partners typically see the highest retention lift from Reputation AI Pro or Conversations AI — worth a dedicated conversation.`,
        mrrAtRisk: 0,
        urgency: account.mrr > 5000 ? "high" : "medium",
        action: "AI adoption conversation",
      });
    }

    // 4. At-risk / churning (skip if billing already covers it)
    if (
      (account.health === "churning" || account.health === "at-risk") &&
      !blockers.some(b => b.account.id === account.id && b.category === "billing")
    ) {
      blockers.push({
        id: `${account.id}-at-risk`,
        category: "at-risk",
        account,
        headline: account.health === "churning" ? "Partner is churning" : "Partner marked at-risk",
        detail: account.notes
          ? account.notes
          : `Health: ${account.health}. No billing decline detected — risk is likely relationship or adoption related. Needs a direct conversation.`,
        mrrAtRisk: account.mrr,
        urgency: account.health === "churning" ? "high" : "medium",
        action: "Save conversation",
      });
    }

    // 5. High-urgency org alerts (top one per account only)
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

  // Sort: high urgency first, then by $ at risk
  return blockers.sort((a, b) => {
    const ord = { high: 0, medium: 1, low: 2 };
    if (ord[a.urgency] !== ord[b.urgency]) return ord[a.urgency] - ord[b.urgency];
    return b.mrrAtRisk - a.mrrAtRisk;
  });
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function TopBlockers() {
  const navigate = useNavigate();
  const { accounts, orgAlerts } = useAM();
  const [activeFilter, setActiveFilter] = useState<BlockerCategory | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [gmailToken, setGmailToken] = useState<string | null>(() => loadGmailToken());
  const [gmailDates, setGmailDates] = useState<Record<string, string>>({});
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);

  const syncGmail = useCallback(async (token: string) => {
    setGmailLoading(true);
    setGmailError(null);
    try {
      const dates = await fetchLastEmailDates(token, accounts);
      setGmailDates(dates);
    } catch {
      setGmailError("Sync failed — reconnect below.");
      clearGmailToken();
      setGmailToken(null);
    } finally {
      setGmailLoading(false);
    }
  }, [accounts]);

  useEffect(() => {
    if (gmailToken && accounts.length > 0 && Object.keys(gmailDates).length === 0) {
      syncGmail(gmailToken);
    }
  }, [gmailToken, accounts, gmailDates, syncGmail]);

  async function connectGmail() {
    setGmailError(null);
    try {
      const result = await signInWithPopup(auth, gmailProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      if (!token) throw new Error();
      saveGmailToken(token);
      setGmailToken(token);
      await syncGmail(token);
    } catch (e: any) {
      if (e?.code !== "auth/popup-closed-by-user") setGmailError("Could not connect Gmail.");
    }
  }

  const blockers = buildBlockers(accounts, orgAlerts, gmailDates);
  const filtered = activeFilter === "all" ? blockers : blockers.filter(b => b.category === activeFilter);

  const categoryCounts = (Object.keys(CATEGORY_META) as BlockerCategory[]).reduce((acc, cat) => {
    acc[cat] = blockers.filter(b => b.category === cat).length;
    return acc;
  }, {} as Record<BlockerCategory, number>);

  const uniquePartners = new Set(blockers.map(b => b.account.id)).size;
  const totalMRRAtRisk = blockers.reduce((s, b) => s + b.mrrAtRisk, 0);
  const highCount = blockers.filter(b => b.urgency === "high").length;

  return (
    <div className="animate-fade-in">
      <Header
        title="Top Blockers"
        subtitle={`${blockers.length} blockers across ${uniquePartners} partners · ${formatCurrency(totalMRRAtRisk)} at risk`}
      />

      <div className="p-6 space-y-5">

        {/* Gmail strip */}
        <div className={cn(
          "px-4 py-2.5 rounded-lg border flex items-center gap-3 text-xs",
          gmailToken ? "bg-v-teal/5 border-v-teal/20" : "bg-secondary border-border"
        )}>
          {gmailToken
            ? <Wifi className="w-3.5 h-3.5 text-v-teal shrink-0" />
            : <WifiOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          <span className="flex-1 text-muted-foreground">
            {gmailToken
              ? "Gmail connected — engagement gaps include last email activity, not just meetings"
              : "Connect Gmail for more accurate engagement tracking (email + meeting combined)"}
            {gmailError && <span className="text-v-red ml-2">{gmailError}</span>}
          </span>
          {gmailToken ? (
            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => syncGmail(gmailToken!)} disabled={gmailLoading}>
              <RefreshCw className={cn("w-3 h-3 mr-1", gmailLoading && "animate-spin")} /> Refresh
            </Button>
          ) : (
            <Button size="sm" className="h-6 text-xs px-2" onClick={connectGmail} disabled={gmailLoading}>
              <Mail className="w-3 h-3 mr-1" /> Connect
            </Button>
          )}
        </div>

        {/* High-urgency alert banner */}
        {highCount > 0 && (
          <div className="p-4 rounded-xl bg-v-red/5 border border-v-red/20 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-v-red mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {highCount} high-urgency blockers need attention this week
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatCurrency(blockers.filter(b => b.urgency === "high").reduce((s, b) => s + b.mrrAtRisk, 0))} in billing directly at risk from high-priority items.
              </p>
            </div>
          </div>
        )}

        {/* Category filter tabs */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
              activeFilter === "all"
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:border-foreground/30"
            )}
          >
            All ({blockers.length})
          </button>
          {(Object.entries(CATEGORY_META) as [BlockerCategory, (typeof CATEGORY_META)[BlockerCategory]][]).map(([cat, meta]) => {
            const count = categoryCounts[cat];
            if (count === 0) return null;
            const isActive = activeFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5",
                  isActive
                    ? `${meta.bg} ${meta.color} ${meta.border}`
                    : "bg-background text-muted-foreground border-border hover:border-foreground/30"
                )}
              >
                <meta.icon className="w-3 h-3" />
                {meta.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Blocker list */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No blockers in this category.
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
                        onClick={() => navigate(
                          blocker.alertId
                            ? `/outreach?account=${blocker.account.id}&intel=${blocker.alertId}`
                            : `/outreach?account=${blocker.account.id}`
                        )}
                      >
                        {blocker.action} <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`mailto:${blocker.account.contactEmail}`)}
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
