// Mine partner emails for flagged issues (product, platform, customer
// service, billing) — feeds the Top Blockers word cloud. Snippets come from
// Gmail (readonly, last 90 days); Gemini classifies them into issues. Only
// issues actually present in the emails are kept — the prompt forbids
// inventing problems.
import type { Account } from "@/data/types";
import { fetchIssueThreads, GmailAuthError, type IssueThread } from "@/lib/gmail";
import { ensureGeminiModel, geminiConfig, geminiText } from "@/lib/gemini";

export type IssueTheme = "product" | "platform" | "service" | "billing";

export interface EmailIssue {
  accountId: string;
  accountName: string;
  theme: IssueTheme;
  title: string;   // short issue statement
  detail: string;  // what the email said, paraphrased with specifics
}

// v3: thinking disabled + chunked classification + loud failure on empty
// responses (v2 could burn its whole output budget on model "thinking",
// read the empty response as zero issues, and cache that for 24h).
const CACHE_KEY = "emailIssues:v3";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function loadCachedIssues(): EmailIssue[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, issues } = JSON.parse(raw);
    if (Date.now() - at > CACHE_MAX_AGE_MS) return null;
    return issues ?? null;
  } catch {
    return null;
  }
}

export function cacheIssues(issues: EmailIssue[]) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), issues }));
}

export function clearCachedIssues() {
  localStorage.removeItem(CACHE_KEY);
}

export async function mineEmailIssues(
  token: string,
  apiKey: string,
  accounts: Account[],
  signal?: AbortSignal,
  onProgress?: (done: number, total: number) => void
): Promise<EmailIssue[]> {
  // 1. Recent conversations per account (subject + per-message snippets,
  // org-wide, invites excluded), batched to respect Gmail rate limits.
  const entries: { accountId: string; accountName: string; threads: IssueThread[] }[] = [];
  const BATCH = 4;
  for (let i = 0; i < accounts.length; i += BATCH) {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    const slice = accounts.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async a => {
        try {
          const threads = await fetchIssueThreads(token, a, 10);
          return { accountId: a.id, accountName: a.name, threads };
        } catch (e) {
          if (e instanceof GmailAuthError) throw e;
          return { accountId: a.id, accountName: a.name, threads: [] };
        }
      })
    );
    entries.push(...results.filter(r => r.threads.length > 0));
    onProgress?.(Math.min(i + BATCH, accounts.length), accounts.length);
  }
  if (entries.length === 0) return [];

  // 2. One Gemini pass over all snippets.
  const systemPrompt = `You read email snippets between a Vendasta account manager and his partners, and extract ISSUES the partner has raised or that are clearly blocking the partnership.

Classify each issue as exactly one theme:
- "product": a Vendasta product not working as expected, missing features, quality complaints
- "platform": platform access, dashboards, login, data/reporting, integrations, technical setup
- "service": customer service, support responsiveness, fulfillment, onboarding experience
- "billing": invoices, charges, credits, pricing disputes

Rules:
- ONLY extract issues actually present in the emails. Scheduling, pleasantries, and marketing are NOT issues. If there are no real issues, return an empty list.
- Access requests, how-to questions, and unresolved asks ("can you assist with…", "still can't see…") ARE issues — classify by what they're about.
- One entry per distinct issue per partner; if a thread shows the issue was clearly resolved, skip it.
- title: one short sentence naming the issue. detail: 1-2 sentences with the specifics from the email.
- Return ONLY valid JSON: {"issues":[{"accountId":"…","theme":"product|platform|service|billing","title":"…","detail":"…"}]}`;

  // Classify in chunks of a few partners per call — one book-wide call blew
  // the output budget and failed silently. Any chunk failure throws, so a
  // partial scan is never cached as "no issues".
  const model = await ensureGeminiModel(apiKey);
  const nameById = new Map(entries.map(e => [e.accountId, e.accountName]));
  const themes: IssueTheme[] = ["product", "platform", "service", "billing"];
  const CHUNK = 6;
  const issues: EmailIssue[] = [];

  for (let i = 0; i < entries.length; i += CHUNK) {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    const chunk = entries.slice(i, i + CHUNK);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: `Email conversations by partner (each thread: subject + message snippets, oldest→newest):\n${JSON.stringify(chunk, null, 1)}` }] }],
          generationConfig: geminiConfig(model, { responseMimeType: "application/json", maxOutputTokens: 8192 }),
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const parsed = JSON.parse(geminiText(await res.json()));
    issues.push(
      ...(parsed.issues ?? [])
        .filter((x: any) => nameById.has(x.accountId) && themes.includes(x.theme) && x.title)
        .map((x: any) => ({
          accountId: x.accountId,
          accountName: nameById.get(x.accountId)!,
          theme: x.theme,
          title: String(x.title),
          detail: String(x.detail ?? ""),
        }))
    );
  }
  return issues;
}
