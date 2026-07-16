import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAM } from "@/context/AMContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { formatCurrency, commissionableMRR, formatDate } from "@/lib/utils";
import {
  Sparkles, ArrowRight, Target, ChevronDown, ChevronUp,
  ClipboardPaste, Loader2, Lightbulb, AlertCircle, ExternalLink,
} from "lucide-react";
import type { Account } from "@/data/types";

// Stored brief fetched from Confluence (meta/weeklyBrief, seeded by
// scripts/seed-firestore.ts from scripts/data/weekly-brief.json).
interface StoredBrief {
  title: string;
  sourceUrl: string;
  author?: string;
  fetchedAt: string;
  content: string;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProductSignal {
  title: string;
  summary: string;
  products: string[];
  urgencyTag?: string;
}

interface BriefAction {
  accountId: string;
  accountName: string;
  product: string;
  urgency: "high" | "medium" | "low";
  action: string;
  rationale: string;
}

interface BriefAnalysis {
  execSummary: string;
  productSignals: ProductSignal[];
  actions: BriefAction[];
}

// ─── Account summaries for Gemini ──────────────────────────────────────────────

function buildAccountSummaries(accounts: Account[]) {
  return accounts.map(a => {
    const latest = a.revenueHistory?.at(-1)?.mrr ?? 0;
    const prior = a.revenueHistory?.at(-2)?.mrr ?? 0;
    // No "mia" here — lastMeeting is a static seed date, and deriving MIA from
    // it told Gemini every account was silent (see Top Blockers fix).
    const situation =
      a.health === "at-risk" || a.health === "churning" ? "at-risk"
      : latest - prior < -1000 ? "declining"
      : a.health === "champion" ? "champion"
      : "stable";
    return {
      id: a.id,
      name: a.name,
      vertical: a.vertical,
      mrr: latest,
      situation,
      aiAdoption: a.aiAdoption,
      products: a.products.slice(0, 5),
      gtmContext: a.gtmContext ?? null,
      contactName: a.contactName,
    };
  }).sort((x, y) => y.mrr - x.mrr);
}

// ─── Gemini call ──────────────────────────────────────────────────────────────

async function analyzeBriefWithGemini(
  brief: string,
  accounts: Account[],
  apiKey: string,
  signal: AbortSignal,
): Promise<BriefAnalysis> {
  const summaries = buildAccountSummaries(accounts);

  const systemPrompt = `You are a strategic advisor for Tanmay Trivedi, a Senior Account Manager at Vendasta (ISV Channel vertical).
Vendasta sells AI-powered SaaS products that Channel Partners (ISVs) resell or embed into their own platforms for SMBs.
Tanmay manages ~32 active Channel Partners at ~$314K MRR.
Key Vendasta products: Reputation AI Pro/Premium, Conversations AI (Pro/Standard/Premium), AI Receptionist, Vibe (AI website builder), Social Marketing Pro, Local SEO Pro.

Your job: read the weekly brief and generate a prioritized action plan that is specific, strategic, and enterprise-grade.
Rules:
- If an account has a gtmContext field, use it to explain WHY the product update matters to THAT partner's actual business and their SMB customers.
- Never write generic "pitch Product X" — write insight-driven recommendations tied to the partner's GTM.
- urgency=high: time-sensitive (incentive expiring, MIA partner, declining revenue).
- urgency=medium: clear fit, this week.
- urgency=low: relevant, no immediate deadline.
- Return ONLY valid JSON. No markdown, no preamble, just the JSON object.`;

  const schemaHint = `{"execSummary":"string","productSignals":[{"title":"string","summary":"string","products":["string"],"urgencyTag":"string|optional"}],"actions":[{"accountId":"string","accountName":"string","product":"string","urgency":"high|medium|low","action":"string","rationale":"string"}]}`;

  const userMessage = `Weekly Brief:\n${brief}\n\nBook of Business:\n${JSON.stringify(summaries)}\n\nReturn JSON matching this schema (max 3 product signals, max 7 actions; action and rationale each 1-2 sentences):\n${schemaHint}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 2048 },
      }),
    },
  );

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return JSON.parse(jsonText) as BriefAnalysis;
}

// ─── Urgency config ───────────────────────────────────────────────────────────

const urgencyConfig = {
  high:   { label: "Act Now",    variant: "danger"  as const },
  medium: { label: "This Week",  variant: "warning" as const },
  low:    { label: "FYI",        variant: "info"    as const },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeeklyBrief() {
  const navigate = useNavigate();
  const { accounts, geminiApiKey } = useAM();
  const [brief, setBrief] = useState("");
  const [storedBrief, setStoredBrief] = useState<StoredBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(true);
  const [analysis, setAnalysis] = useState<BriefAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBrief, setShowBrief] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const userEdited = useRef(false);

  // Load the current brief from Firestore. A manual paste always wins.
  useEffect(() => {
    getDoc(doc(db, "meta", "weeklyBrief"))
      .then(snap => {
        if (snap.exists()) {
          const data = snap.data() as StoredBrief;
          setStoredBrief(data);
          if (!userEdited.current) setBrief(data.content);
        }
      })
      .catch(() => { /* not fatal — paste still works */ })
      .finally(() => setBriefLoading(false));
  }, []);

  async function analyze() {
    if (!geminiApiKey) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const result = await analyzeBriefWithGemini(brief, accounts, geminiApiKey, ctrl.signal);
      setAnalysis(result);
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message ?? "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  // Enrich actions with commissionable value from live account data
  const enrichedActions = (analysis?.actions ?? [])
    .map(action => {
      const acct = accounts.find(a => a.id === action.accountId || a.name === action.accountName);
      return { ...action, commissionable: acct ? commissionableMRR(acct.productBreakdown) : 0 };
    })
    .sort((a, b) => {
      const w = { high: 3, medium: 2, low: 1 };
      return (w[b.urgency] - w[a.urgency]) || (b.commissionable - a.commissionable);
    });

  const highCount = enrichedActions.filter(a => a.urgency === "high").length;

  return (
    <div className="animate-fade-in">
      <Header
        title="Weekly Brief"
        subtitle="The latest Product Brief from Confluence, mapped to your book of business by Gemini"
      />

      <div className="p-6 space-y-5">

        {/* Input */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="flex items-center gap-1.5">
                  <ClipboardPaste className="w-3.5 h-3.5 text-v-blue" />
                  {storedBrief ? storedBrief.title : "Weekly R&D / Marketing Brief"}
                </CardTitle>
                {storedBrief ? (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                    <span>{storedBrief.author ? `${storedBrief.author} · ` : ""}pulled from Confluence {formatDate(storedBrief.fetchedAt)}</span>
                    <a href={storedBrief.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-v-blue hover:underline">
                      <ExternalLink className="w-2.5 h-2.5" /> open source page
                    </a>
                    <span>· paste below to override</span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    {briefLoading ? "Loading the stored brief…" : "No stored brief found — copy the latest Product Brief from Confluence and paste here."}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowBrief(!showBrief)}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                {showBrief
                  ? <><ChevronUp className="w-3 h-3" /> Hide</>
                  : <><ChevronDown className="w-3 h-3" /> Show brief</>}
              </button>
            </div>
          </CardHeader>
          {showBrief && (
            <CardContent className="pt-0 space-y-3">
              <textarea
                value={brief}
                onChange={e => { userEdited.current = true; setBrief(e.target.value); }}
                rows={14}
                placeholder="Paste your weekly brief here..."
                className="w-full px-3 py-2.5 text-xs font-mono rounded-lg border border-border bg-secondary/30 focus:outline-none focus:ring-2 focus:ring-ring resize-none leading-relaxed"
              />
            </CardContent>
          )}
          <CardContent className={showBrief ? "pt-0" : ""}>
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                onClick={analyze}
                disabled={loading || !brief.trim() || !geminiApiKey}
              >
                {loading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
                  : <><Sparkles className="w-3.5 h-3.5" /> Generate Action Plan</>}
              </Button>
              {!geminiApiKey && (
                <span className="flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Gemini key not configured — run <code className="bg-secondary px-1 rounded">GEMINI_API_KEY=... npx tsx scripts/seed-firestore.ts</code>
                </span>
              )}
              {geminiApiKey && !showBrief && brief.trim() && storedBrief && (
                <span className="text-xs text-muted-foreground">"{storedBrief.title}" loaded — click Generate, or Show brief to review/override</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Analyzing brief against your book of business...</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-500/5 border border-red-500/20 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Results */}
        {analysis && !loading && (
          <div className="space-y-5 animate-fade-in">

            {/* Exec summary */}
            {analysis.execSummary && (
              <div className="p-4 rounded-xl bg-v-purple/5 border border-v-purple/20">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-v-purple mt-0.5 shrink-0" />
                  <p className="text-sm text-foreground leading-relaxed">{analysis.execSummary}</p>
                </div>
              </div>
            )}

            {/* Product signals */}
            {analysis.productSignals?.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" />
                  Product Signals Extracted
                </h2>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {analysis.productSignals.map((sig, idx) => (
                    <Card key={idx} className="border-border/60">
                      <CardContent className="p-3.5">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-sm font-semibold text-foreground leading-tight">{sig.title}</p>
                          {sig.urgencyTag && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-v-blue/10 text-v-blue font-medium shrink-0">{sig.urgencyTag}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{sig.summary}</p>
                        {sig.products?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {sig.products.map(p => (
                              <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{p}</span>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Action plan */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Target className="w-4 h-4 text-v-teal" />
                <h2 className="text-sm font-semibold text-foreground">
                  {enrichedActions.length} Account-Aligned Actions
                </h2>
                {highCount > 0 && <Badge variant="danger">{highCount} urgent</Badge>}
                <span className="text-xs text-muted-foreground">ranked by urgency then commissionable book value</span>
              </div>

              <div className="space-y-2.5">
                {enrichedActions.map((action, idx) => {
                  const urg = urgencyConfig[action.urgency];
                  const acct = accounts.find(a => a.id === action.accountId || a.name === action.accountName);
                  return (
                    <Card key={idx}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3 flex-wrap">
                          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                            <Target className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="text-sm font-semibold text-foreground">{action.accountName}</p>
                              <Badge variant={urg.variant}>{urg.label}</Badge>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-v-blue/10 text-v-blue font-medium">{action.product}</span>
                              {action.commissionable > 0 && (
                                <span className="text-xs font-medium text-v-teal">{formatCurrency(action.commissionable)}/mo commissionable</span>
                              )}
                            </div>
                            <p className="text-sm text-foreground">{action.action}</p>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{action.rationale}</p>
                          </div>
                          {acct && (
                            <Button size="sm" variant="outline" onClick={() => navigate(`/outreach?account=${acct.id}`)}>
                              Outreach <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
