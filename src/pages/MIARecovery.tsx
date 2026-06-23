import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, daysSince, formatCurrency } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useAM } from "@/context/AMContext";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, gmailProvider } from "@/lib/firebase";
import { fetchLastEmailDates, saveGmailToken, loadGmailToken, clearGmailToken } from "@/lib/gmail";
import {
  UserX, Clock, TrendingDown, AlertTriangle,
  Mail, Calendar, ArrowRight, Flame, MessageCircle,
  Wifi, WifiOff, RefreshCw,
} from "lucide-react";
import { type Account } from "@/data/types";

const MIA_THRESHOLD = 45;

// Effective last-contact date: most recent of lastMeeting (from data) and
// lastEmail (from Gmail live sync). Falls back to lastMeeting if Gmail isn't connected.
function effectiveLastContact(account: Account, gmailDates: Record<string, string>): string {
  const meeting = account.lastMeeting;
  const email = gmailDates[account.id];
  if (!email) return meeting;
  return email > meeting ? email : meeting;
}

function daysSinceContact(account: Account, gmailDates: Record<string, string>): number {
  return daysSince(effectiveLastContact(account, gmailDates));
}

function getRiskLevel(account: Account, gmailDates: Record<string, string>): "critical" | "high" | "medium" {
  const days = daysSinceContact(account, gmailDates);
  const declining = account.mrr < account.mrrPrev;
  if (days > 80 || account.health === "churning") return "critical";
  if (days > 60 || declining) return "high";
  return "medium";
}

function getReEngagementHook(account: Account, gmailDates: Record<string, string>): string {
  const days = daysSinceContact(account, gmailDates);
  if (account.health === "churning") {
    return `${account.name} hasn't engaged in ${days} days and billing is declining. Send a personal video or executive escalation before they churn.`;
  }
  return `${account.contactName} hasn't responded in ${days} days. A value-forward email with a specific stat about their account ("your reviews grew X%") tends to cut through.`;
}

function getReEngagementEmail(account: Account, gmailDates: Record<string, string>): string {
  const firstName = account.contactName.split(" ")[0];
  const days = daysSinceContact(account, gmailDates);

  if (account.health === "churning") {
    return `Hi ${firstName},\n\nI'll be honest — I haven't heard from you in a while and I'm not sure if something's gone wrong on our end.\n\nI genuinely value ${account.name} as a partner and I want to make sure you're getting value from what we're doing together. Can we get 20 minutes this week? I'd love to hear how things are going and show you what's been working for similar businesses.\n\nNo pitch — just a conversation.\n\nTanmay`;
  }

  return `Hi ${firstName},\n\nIt's been about ${days} days since we last connected, and I wanted to reach out with something I thought you'd actually find useful.\n\nThis month, ${account.name}'s online reviews have continued to come in — and I noticed a few patterns worth discussing. I put together a quick 2-minute overview that I think you'll want to see.\n\nWould you have 15 minutes this week? Happy to work around your schedule.\n\nBest,\nTanmay`;
}

export default function MIARecovery() {
  const navigate = useNavigate();
  const { accounts } = useAM();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Gmail sync state
  const [gmailToken, setGmailToken] = useState<string | null>(() => loadGmailToken());
  const [gmailDates, setGmailDates] = useState<Record<string, string>>({});
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const syncGmail = useCallback(async (token: string) => {
    setGmailLoading(true);
    setGmailError(null);
    try {
      const dates = await fetchLastEmailDates(token, accounts);
      setGmailDates(dates);
      setLastSynced(new Date());
    } catch {
      setGmailError("Gmail sync failed. Your token may have expired — reconnect below.");
      clearGmailToken();
      setGmailToken(null);
    } finally {
      setGmailLoading(false);
    }
  }, [accounts]);

  // Auto-sync on load if token is available
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
      if (!token) throw new Error("No access token returned");
      saveGmailToken(token);
      setGmailToken(token);
      await syncGmail(token);
    } catch (e: any) {
      if (e?.code !== "auth/popup-closed-by-user") {
        setGmailError("Could not connect Gmail. Try again.");
      }
    }
  }

  function disconnectGmail() {
    clearGmailToken();
    setGmailToken(null);
    setGmailDates({});
    setLastSynced(null);
  }

  const miaAccounts = accounts
    .filter(a => a.isMIA || daysSinceContact(a, gmailDates) >= MIA_THRESHOLD)
    .sort((a, b) => daysSinceContact(b, gmailDates) - daysSinceContact(a, gmailDates));

  const watchlist = accounts.filter(a => {
    const days = daysSinceContact(a, gmailDates);
    return !a.isMIA && days >= 30 && days < MIA_THRESHOLD;
  });

  const totalMRRAtRisk = miaAccounts.reduce((s, a) => s + a.mrr, 0);
  const gmailConnected = !!gmailToken;

  return (
    <div className="animate-fade-in">
      <Header
        title="MIA Recovery"
        subtitle={`${miaAccounts.length} partners gone dark · ${formatCurrency(totalMRRAtRisk)} billings at risk`}
      />

      <div className="p-6 space-y-6">
        {/* Gmail sync banner */}
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${gmailConnected ? "bg-v-teal/5 border-v-teal/20" : "bg-secondary border-border"}`}>
          {gmailConnected
            ? <Wifi className="w-4 h-4 text-v-teal mt-0.5 shrink-0" />
            : <WifiOff className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          }
          <div className="flex-1 min-w-0">
            {gmailConnected ? (
              <>
                <p className="text-sm font-semibold text-foreground">
                  Gmail connected — last communication dates are live
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  MIA threshold uses the most recent of your last meeting <em>or</em> last email with each partner.
                  {lastSynced && <> Last synced {lastSynced.toLocaleTimeString()}.</>}
                  {gmailLoading && <> Syncing…</>}
                </p>
                {gmailError && <p className="text-xs text-v-red mt-1">{gmailError}</p>}
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground">Connect Gmail to sync last communication dates</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Without Gmail, MIA uses <code>lastMeeting</code> from Firestore — which may be weeks behind your actual email activity. Connect once; your token is cached for 55 minutes.
                </p>
                {gmailError && <p className="text-xs text-v-red mt-1">{gmailError}</p>}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {gmailConnected ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => syncGmail(gmailToken!)}
                  disabled={gmailLoading}
                >
                  <RefreshCw className={`w-3 h-3 ${gmailLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button size="sm" variant="ghost" onClick={disconnectGmail} className="text-muted-foreground">
                  Disconnect
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={connectGmail} disabled={gmailLoading}>
                <Mail className="w-3.5 h-3.5" />
                Connect Gmail
              </Button>
            )}
          </div>
        </div>

        {/* Summary Banner */}
        <div className="p-4 rounded-xl bg-v-red/5 border border-v-red/20 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-v-red mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {miaAccounts.length} partners have had no contact in {MIA_THRESHOLD}+ days
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              MIA definition: no meeting <em>or email</em> in 45 days
              {gmailConnected ? " (Gmail + meeting data combined)" : " (meeting data only — connect Gmail for email activity)"}.
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
              const days = daysSinceContact(account, gmailDates);
              const lastEmailDate = gmailDates[account.id];
              const risk = getRiskLevel(account, gmailDates);
              const hook = getReEngagementHook(account, gmailDates);
              const email = getReEngagementEmail(account, gmailDates);
              const isOpen = expanded === account.id;
              const declining = account.mrr < account.mrrPrev;

              return (
                <Card key={account.id} className={`transition-all ${risk === "critical" ? "border-v-red/40" : risk === "high" ? "border-v-amber/40" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                        {account.name.slice(0, 2)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{account.name}</p>
                          <Badge variant={risk === "critical" ? "danger" : risk === "high" ? "warning" : "outline"}>
                            {risk === "critical" ? "Critical" : risk === "high" ? "High Risk" : "Watch"}
                          </Badge>
                          {declining && (
                            <div className="flex items-center gap-1 text-xs text-v-red">
                              <TrendingDown className="w-3 h-3" /> Billing declining
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{account.contactName} · {account.contactTitle} · {account.vertical}</p>

                        <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span className={days > 60 ? "text-v-red font-medium" : ""}>{days} days since last contact</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Last meeting: {formatDate(account.lastMeeting)}
                          </div>
                          {lastEmailDate && (
                            <div className="flex items-center gap-1 text-xs text-v-teal">
                              <Mail className="w-3 h-3" />
                              Last email: {formatDate(lastEmailDate)}
                            </div>
                          )}
                          <div className="text-xs font-medium text-foreground">
                            MRR: {formatCurrency(account.mrr)}
                          </div>
                        </div>

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
                              <Button size="sm" variant="ghost" onClick={() => navigate(`/strategize?account=${account.id}`)}>
                                Strategize <ArrowRight className="w-3.5 h-3.5" />
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
                        <p className="text-xs text-muted-foreground">
                          {daysSinceContact(account, gmailDates)} days · last contact {formatDate(effectiveLastContact(account, gmailDates))}
                          {gmailDates[account.id] && gmailDates[account.id] > account.lastMeeting && (
                            <span className="ml-1 text-v-teal">(email)</span>
                          )}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/strategize?account=${account.id}`)}>
                        Strategize <ArrowRight className="w-3 h-3" />
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
