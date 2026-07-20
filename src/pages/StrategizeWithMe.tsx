import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { useAM } from "@/context/AMContext";
import { formatCurrency, getLatestMRR, getQoQBaseMRR, pctChange, daysSince } from "@/lib/utils";
import { aiProductsOf } from "@/lib/products";
import { type Account, type AMProfile } from "@/data/types";
import { Send, Sparkles, RotateCcw, Copy, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Markdown renderer ────────────────────────────────────────────────────────

function MarkdownText({ content }: { content: string }) {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  function renderInline(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const re = /(\*\*(.+?)\*\*|`([^`]+)`|\*(.+?)\*)/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      if (m[2] !== undefined) parts.push(<strong key={m.index}>{m[2]}</strong>);
      else if (m[3] !== undefined) parts.push(<code key={m.index} className="bg-secondary px-1 rounded text-[11px] font-mono">{m[3]}</code>);
      else if (m[4] !== undefined) parts.push(<em key={m.index}>{m[4]}</em>);
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  }

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { nodes.push(<div key={i} className="h-2" />); i++; continue; }
    if (/^#{1,3} /.test(line)) {
      nodes.push(<p key={i} className="font-semibold text-foreground mt-1">{renderInline(line.replace(/^#+\s/, ""))}</p>);
      i++; continue;
    }
    if (/^(\s*[-*•]\s|\s*\d+\.\s)/.test(line)) {
      const items: string[] = [];
      const isOrdered = /^\s*\d+\./.test(line);
      while (i < lines.length && /^(\s*[-*•]\s|\s*\d+\.\s)/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s/, "").replace(/^\s*\d+\.\s/, ""));
        i++;
      }
      const Tag = isOrdered ? "ol" : "ul";
      nodes.push(
        <Tag key={i} className={isOrdered ? "list-decimal list-inside space-y-0.5 my-1" : "list-disc list-inside space-y-0.5 my-1"}>
          {items.map((it, j) => <li key={j} className="text-sm">{renderInline(it)}</li>)}
        </Tag>
      );
      continue;
    }
    nodes.push(<p key={i} className="text-sm leading-relaxed">{renderInline(line)}</p>);
    i++;
  }
  return <div className="space-y-0.5">{nodes}</div>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: Date;
}

// ─── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(accounts: Account[], _selectedAM: AMProfile): string {
  const active = accounts.filter(a => getLatestMRR(a.revenueHistory) > 0);
  const totalMRR = active.reduce((s, a) => s + getLatestMRR(a.revenueHistory), 0);
  const totalBase = active.reduce((s, a) => s + getQoQBaseMRR(a.revenueHistory), 0);
  const qoqPct = pctChange(totalMRR, totalBase);
  const miaCount = accounts.filter(a => a.isMIA || daysSince(a.lastMeeting) >= 45).length;

  const accountLines = active
    .sort((a, b) => getLatestMRR(b.revenueHistory) - getLatestMRR(a.revenueHistory))
    .map(a => {
      const mrr = getLatestMRR(a.revenueHistory);
      const base = getQoQBaseMRR(a.revenueHistory);
      const delta = mrr - base;
      const aiProds = aiProductsOf(a).map(p => p.name).join(", ") || "none";
      const days = daysSince(a.lastMeeting);
      return `• ${a.name} (${a.vertical}) — ${formatCurrency(mrr)}/mo | ${delta >= 0 ? "+" : ""}${formatCurrency(delta)} QoQ | ${a.health} | AI: ${aiProds} | Contact: ${a.contactName} <${a.contactEmail}> | Last contact: ${days}d ago${a.isMIA || days >= 45 ? " [MIA]" : ""} | ${a.notes.slice(0, 120)}`;
    })
    .join("\n");

  return `You are Tanmay Trivedi's strategic AM assistant with full access to his live book of business at Vendasta.

ABOUT TANMAY:
- Role: Senior Account Manager, ISV vertical at Vendasta
- Book: ${active.length} active Channel partners, ${formatCurrency(totalMRR)} total MRR
- QoQ trend: ${qoqPct >= 0 ? "+" : ""}${qoqPct}% vs March 2026 close (the commission baseline)
- Commission basis: WAMGR — weighted average monthly growth rate across the book, Q2 2026 (Apr–Jun vs Mar close)
- MIA accounts: ${miaCount} partners with no contact in 45+ days
- Today: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}

BOOK OF BUSINESS:
${accountLines}

WRITING STYLE (for any email drafts):
- Active voice, no exclamation points, no filler phrases ("hope this finds you", "circle back", "touch base")
- Lead with the point — no throat-clearing
- Reference the existing relationship, not cold framing
- Reference Brendan King's March 20 "Strategic Discussion: 2026 AI Roadmap" email when relevant as shared context
- Sign all emails "Tanmay"
- Vendasta products to mention: Reputation AI Pro/Premium, Conversations AI (Pro/Standard/Premium), AI Receptionist, Vibe (AI website/app builder), Social Marketing Pro, Local SEO Pro

DOMAIN NOTES:
- ApartmentRatings → contact at internetbrands.com (parent)
- LocalBizNOW → contact at ansira.com
- Web.com → parent is Newfold Digital (newfold.com)
- Platr.ai → operating entity is takeout7.com
- Telkom SA true run rate is ~$62K/mo (Apr/May billing artifacts due to a $20K overcharge and credit)
- UWM and Web.com are minimum monthly commitments — stable by contract, not at churn risk

Be specific, direct, and actionable. Reference actual account names, dollar amounts, and contact names. Keep responses concise. When drafting emails, write the full email ready to send — no placeholders.`;
}

// ─── Quick-start prompts ───────────────────────────────────────────────────────

const QUICK_STARTS = [
  "What's my single best expansion opportunity this week?",
  "Which MIA accounts are highest risk to my Q2 commission?",
  "Draft a re-engagement email to my biggest MIA account.",
  "How am I tracking toward Q2 commission? What's the gap?",
  "Which 3 accounts should I prioritize for a QBR this month?",
  "Which partners have no AI products that are good upsell targets?",
];

// ─── Streaming API call ────────────────────────────────────────────────────────

async function streamChat(
  apiKey: string,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  onChunk: (chunk: string) => void,
  signal: AbortSignal
): Promise<void> {
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`,
    {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 1024 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message ?? `API error ${res.status}`);
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) return;

  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data);
        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (text) onChunk(text);
      } catch {
        // malformed SSE chunk — skip
      }
    }
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function StrategizeWithMe() {
  const [searchParams] = useSearchParams();
  const { accounts, selectedAM } = useAM();
  const accountId = searchParams.get("account");
  const focusAccount = accounts.find(a => a.id === accountId);

  const { geminiApiKey: apiKey } = useAM();
  const systemPrompt = buildSystemPrompt(accounts, selectedAM);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(() =>
    focusAccount ? `Tell me the best play for ${focusAccount.name} right now.` : ""
  );
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    if (!apiKey) {
      setError("Gemini API key not configured. Run: GEMINI_API_KEY=your_key npx tsx scripts/seed-firestore.ts");
      return;
    }

    setError(null);
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed, ts: new Date() };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", ts: new Date() };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);

    abortRef.current = new AbortController();

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    try {
      await streamChat(
        apiKey,
        systemPrompt,
        history,
        (chunk) => {
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m)
          );
        },
        abortRef.current.signal
      );
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message ?? "Something went wrong. Try again.");
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [streaming, apiKey, messages, systemPrompt]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function stop() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  function reset() {
    stop();
    setMessages([]);
    setError(null);
    setInput("");
  }

  async function copyMsg(content: string, id: string) {
    await navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const active = accounts.filter(a => getLatestMRR(a.revenueHistory) > 0);
  const totalMRR = active.reduce((s, a) => s + getLatestMRR(a.revenueHistory), 0);
  const totalBase = active.reduce((s, a) => s + getQoQBaseMRR(a.revenueHistory), 0);
  const qoqPct = pctChange(totalMRR, totalBase);
  const miaCount = accounts.filter(a => a.isMIA || daysSince(a.lastMeeting) >= 45).length;
  const noAICount = accounts.filter(a => getLatestMRR(a.revenueHistory) > 0 && aiProductsOf(a).length === 0).length;

  const isEmpty = messages.length === 0;

  return (
    <div className="animate-fade-in flex flex-col h-screen">
      <Header
        title="Strategize with me"
        subtitle="Ask anything about your book, accounts, or next move"
      />

      <div className="flex flex-col flex-1 min-h-0 p-6 gap-4">

        {/* No API key warning */}
        {!apiKey && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-v-amber/5 border border-v-amber/20">
            <AlertCircle className="w-4 h-4 text-v-amber mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Gemini API key not configured</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Run <code className="bg-secondary px-1 rounded text-[11px]">GEMINI_API_KEY=... npx tsx scripts/seed-firestore.ts</code> to seed the key to Firestore.
              </p>
            </div>
          </div>
        )}

        {/* Conversation area */}
        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-border bg-secondary/30 p-4 space-y-1">

          {/* Empty state — book snapshot */}
          {isEmpty && (
            <div className="space-y-4">
              <div className="rounded-xl bg-background border border-border p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-v-blue/10 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-v-blue" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Here's where things stand</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total MRR", value: formatCurrency(totalMRR), sub: `${qoqPct >= 0 ? "+" : ""}${qoqPct}% QoQ` },
                    { label: "Active Partners", value: String(active.length), sub: "in book" },
                    { label: "MIA", value: String(miaCount), sub: "no contact 45d+" },
                    { label: "No AI", value: String(noAICount), sub: "expansion targets" },
                  ].map(stat => (
                    <div key={stat.label} className="rounded-lg bg-secondary/60 p-3">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                      <p className="text-xl font-bold text-foreground mt-0.5">{stat.value}</p>
                      <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ask a question below, or pick one of the suggested prompts to get started.
                  {focusAccount && (
                    <span className="ml-1 font-medium text-foreground">
                      You came here from {focusAccount.name} — I've pre-filled a question about them.
                    </span>
                  )}
                </p>
              </div>

              {/* Quick-start prompts */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Suggested questions</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_STARTS.map(q => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      disabled={streaming || !apiKey}
                      className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-secondary transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <div key={msg.id} className={cn("group flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
              {/* Avatar */}
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-1",
                msg.role === "user" ? "bg-blue-500 text-white" : "bg-v-blue/10 text-v-blue"
              )}>
                {msg.role === "user" ? selectedAM.avatar : "AI"}
              </div>

              {/* Bubble */}
              <div className={cn(
                "flex-1 max-w-[82%]",
                msg.role === "user" ? "flex flex-col items-end" : ""
              )}>
                <div className={cn(
                  "rounded-2xl px-4 py-3",
                  msg.role === "user"
                    ? "bg-v-blue text-white rounded-tr-sm text-sm leading-relaxed whitespace-pre-wrap"
                    : "bg-background border border-border text-foreground rounded-tl-sm"
                )}>
                  {msg.role === "assistant" ? <MarkdownText content={msg.content} /> : msg.content}
                  {streaming && msg.role === "assistant" && msg.content === "" && (
                    <span className="inline-flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  )}
                </div>

                {/* Copy button — assistant messages only */}
                {msg.role === "assistant" && msg.content && (
                  <button
                    onClick={() => copyMsg(msg.content, msg.id)}
                    className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground px-1"
                  >
                    {copied === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied === msg.id ? "Copied" : "Copy"}
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-v-red/5 border border-v-red/20 text-xs text-v-red">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick prompts when conversation is already started */}
        {!isEmpty && (
          <div className="flex flex-wrap gap-2">
            {QUICK_STARTS.slice(0, 3).map(q => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={streaming || !apiKey}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="flex items-end gap-2">
          <div className="flex-1 flex items-end gap-2 rounded-xl border border-border bg-background px-4 py-3 focus-within:ring-2 focus-within:ring-v-blue/30 focus-within:border-v-blue/40 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your book, an account, or request an email draft…"
              rows={1}
              disabled={streaming}
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed disabled:opacity-60"
              style={{ minHeight: "24px", maxHeight: "160px" }}
            />
          </div>

          {streaming ? (
            <Button size="sm" variant="outline" onClick={stop} className="h-11 px-4 shrink-0">
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => send(input)}
              disabled={!input.trim() || !apiKey}
              className="h-11 px-4 shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}

          {!isEmpty && (
            <Button size="sm" variant="ghost" onClick={reset} className="h-11 px-3 shrink-0 text-muted-foreground">
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          Powered by Gemini · Your book data stays in this browser · Responses may be wrong — verify before sending
        </p>
      </div>
    </div>
  );
}
