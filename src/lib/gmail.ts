// Gmail API helpers for MIA last-communication sync.
// All calls are read-only (gmail.readonly scope) and run entirely in the browser
// using the short-lived access token obtained via signInWithPopup + gmailProvider.

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

// Thrown on 401/403 so the UI can distinguish "token expired — reconnect"
// from "no email history found". Swallowing these produced empty syncs that
// looked like a working connection with no data.
export class GmailAuthError extends Error {}

interface ThreadListResponse {
  threads?: { id: string; snippet: string }[];
  nextPageToken?: string;
}

interface Thread {
  id: string;
  messages?: { internalDate: string }[];
}

// Partner email domain ≠ website domain for these accounts (see CLAUDE.md).
// Used for the domain-level fallback when no individual contact email exists,
// and to widen the search when the contact writes from a different entity.
const DOMAIN_OVERRIDES: Record<string, string> = {
  "acc-apart": "internetbrands.com",   // ApartmentRatings
  "acc-web": "newfold.com",            // Web.com (parent)
  "acc-localbiz": "ansira.com",        // LocalBizNOW
  "acc-platrai": "takeout7.com",       // Platr.ai (operating entity)
  "acc-das": "digitalairstrike.com",   // Digital Air Strike
};

async function gmailFetch(token: string, url: string): Promise<any | null> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new GmailAuthError(`Gmail API ${res.status}`);
  }
  if (!res.ok) return null;
  return res.json();
}

// Returns the most recent email date (ms epoch) matching the query.
// Searches both sent and received. Returns null if no thread found.
async function latestThreadDate(token: string, query: string): Promise<number | null> {
  const url = `${BASE}/threads?q=${encodeURIComponent(query)}&maxResults=1`;

  const data: ThreadListResponse | null = await gmailFetch(token, url);
  const threadId = data?.threads?.[0]?.id;
  if (!threadId) return null;

  const thread: Thread | null = await gmailFetch(
    token,
    `${BASE}/threads/${threadId}?format=METADATA&metadataHeaders=Date`
  );
  // messages are ordered oldest→newest; the LAST one is the latest reply.
  // (Reading messages[0] here was the root cause of stale contact dates.)
  const msgs = thread?.messages ?? [];
  const dateMs = parseInt(msgs[msgs.length - 1]?.internalDate ?? "0", 10);
  return dateMs > 0 ? dateMs : null;
}

// Build the Gmail search query for an account. Searches the whole partner
// ORG (contact address + company domain), not just the contact-of-record —
// issues are usually raised by other people at the partner (e.g. a Telkom
// engineer, not the exec contact). Bulk-mail noise is excluded.
export function buildGmailQuery(a: { id: string; contactEmail: string; website?: string }): string | null {
  const hasRealEmail =
    a.contactEmail && !a.contactEmail.startsWith("contact@") && a.contactEmail.includes("@");
  const contactDomain = hasRealEmail ? a.contactEmail.split("@")[1] : null;
  const domain = (DOMAIN_OVERRIDES[a.id] ?? a.website ?? contactDomain ?? "").replace(/^www\./, "");

  const parties = new Set<string>();
  if (hasRealEmail) parties.add(a.contactEmail);
  if (domain.includes(".")) parties.add(`@${domain}`);
  if (contactDomain && contactDomain !== domain) parties.add(`@${contactDomain}`);
  if (parties.size === 0) return null;

  const list = [...parties].join(" OR ");
  return `(from:(${list}) OR to:(${list})) -from:noreply -from:no-reply -category:promotions`;
}

// Calendar traffic drowns real conversations for active partners — exclude
// it when mining for issues.
const INVITE_NOISE = `-subject:"Invitation:" -subject:"Updated invitation:" -subject:"Accepted:" -subject:"Declined:" -subject:"Canceled event:" -filename:invite.ics`;

// Returns a map of accountId → last email date (ISO string). Runs fetches
// concurrently in batches of 5 to stay under Gmail API rate limits.
// GmailAuthError propagates so the caller can prompt a reconnect.
export async function fetchLastEmailDates(
  token: string,
  accounts: { id: string; contactEmail: string; website?: string }[]
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  const BATCH = 5;

  const searchable = accounts
    .map((a) => ({ id: a.id, query: buildGmailQuery(a) }))
    .filter((a): a is { id: string; query: string } => a.query !== null);

  for (let i = 0; i < searchable.length; i += BATCH) {
    const slice = searchable.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async (a) => {
        const ms = await latestThreadDate(token, a.query);
        if (ms) {
          results[a.id] = new Date(ms).toISOString().slice(0, 10);
        }
      })
    );
  }

  return results;
}

// Conversation pull for issue mining: recent non-invite threads with their
// SUBJECT and per-message snippets, so the classifier sees the actual
// back-and-forth (a bare thread snippet is ~100 chars of the last message
// and misses issues raised earlier in the conversation).
export interface IssueThread {
  subject: string;
  snippets: string[]; // per-message snippets, oldest → newest (last 5)
}

export async function fetchIssueThreads(
  token: string,
  account: { id: string; contactEmail: string; website?: string },
  n = 10
): Promise<IssueThread[]> {
  const query = buildGmailQuery(account);
  if (!query) return [];
  const list: ThreadListResponse | null = await gmailFetch(
    token,
    `${BASE}/threads?q=${encodeURIComponent(`(${query}) ${INVITE_NOISE} newer_than:90d`)}&maxResults=${n}`
  );
  const threads = list?.threads ?? [];
  const detailed = await Promise.all(
    threads.map(async t => {
      const detail: any = await gmailFetch(
        token,
        `${BASE}/threads/${t.id}?format=METADATA&metadataHeaders=Subject`
      );
      const msgs: any[] = detail?.messages ?? [];
      const subject =
        msgs[0]?.payload?.headers?.find((h: any) => h.name.toLowerCase() === "subject")?.value ?? "(no subject)";
      const snippets = msgs.slice(-5).map(m => m.snippet).filter(Boolean);
      return snippets.length > 0 ? { subject, snippets } : null;
    })
  );
  return detailed.filter((t): t is IssueThread => t !== null);
}

// Recent conversations with a partner (for the profile page's "last 3
// conversations" panel). Subject + latest-message date + snippet per thread.
export interface RecentThread {
  id: string;
  date: string;    // ISO date of the newest message in the thread
  subject: string;
  snippet: string;
}

export async function fetchRecentThreads(
  token: string,
  account: { id: string; contactEmail: string; website?: string },
  n = 3
): Promise<RecentThread[]> {
  const query = buildGmailQuery(account);
  if (!query) return [];

  const list: (ThreadListResponse & { threads?: { id: string; snippet: string }[] }) | null =
    await gmailFetch(token, `${BASE}/threads?q=${encodeURIComponent(query)}&maxResults=${n}`);
  const threads = list?.threads ?? [];

  const results = await Promise.all(
    threads.map(async (t) => {
      const detail: (Thread & { messages?: { internalDate: string; payload?: { headers?: { name: string; value: string }[] } }[] }) | null =
        await gmailFetch(token, `${BASE}/threads/${t.id}?format=METADATA&metadataHeaders=Subject`);
      const msgs = detail?.messages ?? [];
      const last = msgs[msgs.length - 1];
      const subject =
        msgs[0]?.payload?.headers?.find((h) => h.name.toLowerCase() === "subject")?.value ?? "(no subject)";
      const ms = parseInt(last?.internalDate ?? "0", 10);
      return {
        id: t.id,
        date: ms > 0 ? new Date(ms).toISOString().slice(0, 10) : "",
        subject,
        snippet: t.snippet ?? "",
      };
    })
  );
  return results.filter((r) => r.date).sort((a, b) => (a.date < b.date ? 1 : -1));
}

// Persist/restore the Gmail token across page reloads. Token is short-lived
// (~1 hr) so we store the expiry alongside it.
const TOKEN_KEY = "gmail_token";
const EXPIRY_KEY = "gmail_token_expiry";
const DATES_KEY = "gmail_last_dates";

export function saveGmailToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  // Google access tokens last ~1 hour; we'll treat 55 min as the safe window.
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + 55 * 60 * 1000));
}

export function loadGmailToken(): string | null {
  const expiry = parseInt(localStorage.getItem(EXPIRY_KEY) ?? "0", 10);
  if (Date.now() > expiry) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

export function clearGmailToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
}

// Cache the synced dates so navigating away and back doesn't re-run the full
// N-account fetch (and so engagement data survives token expiry).
const DATES_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function saveGmailDates(dates: Record<string, string>) {
  localStorage.setItem(DATES_KEY, JSON.stringify({ at: Date.now(), dates }));
}

export function loadGmailDates(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(DATES_KEY);
    if (!raw) return null;
    const { at, dates } = JSON.parse(raw);
    if (Date.now() - at > DATES_MAX_AGE_MS) return null;
    return dates ?? null;
  } catch {
    return null;
  }
}
