// Gmail API helpers for MIA last-communication sync.
// All calls are read-only (gmail.readonly scope) and run entirely in the browser
// using the short-lived access token obtained via signInWithPopup + gmailProvider.

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

interface ThreadListResponse {
  threads?: { id: string; snippet: string }[];
  nextPageToken?: string;
}

interface Thread {
  id: string;
  messages?: { internalDate: string }[];
}

// Returns the most recent email date (ms epoch) between Tanmay and the given
// email address. Searches both sent and received. Returns null if no thread found.
async function latestThreadDate(token: string, email: string): Promise<number | null> {
  if (!email || email.startsWith("contact@")) return null;

  const query = encodeURIComponent(`from:${email} OR to:${email}`);
  const url = `${BASE}/threads?q=${query}&maxResults=1`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;

  const data: ThreadListResponse = await res.json();
  const threadId = data.threads?.[0]?.id;
  if (!threadId) return null;

  const threadRes = await fetch(`${BASE}/threads/${threadId}?format=METADATA&metadataHeaders=Date`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!threadRes.ok) return null;

  const thread: Thread = await threadRes.json();
  const dateMs = parseInt(thread.messages?.[0]?.internalDate ?? "0", 10);
  return dateMs > 0 ? dateMs : null;
}

// Returns a map of accountId → last email date (ISO string) for every account
// whose contactEmail is a real individual address. Runs fetches concurrently
// in batches of 5 to stay under Gmail API rate limits.
export async function fetchLastEmailDates(
  token: string,
  accounts: { id: string; contactEmail: string }[]
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  const BATCH = 5;

  const real = accounts.filter(
    (a) =>
      a.contactEmail &&
      !a.contactEmail.startsWith("contact@") &&
      a.contactEmail.includes("@")
  );

  for (let i = 0; i < real.length; i += BATCH) {
    const slice = real.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async (a) => {
        const ms = await latestThreadDate(token, a.contactEmail);
        if (ms) {
          results[a.id] = new Date(ms).toISOString().slice(0, 10);
        }
      })
    );
  }

  return results;
}

// Persist/restore the Gmail token across page reloads. Token is short-lived
// (~1 hr) so we store the expiry alongside it.
const TOKEN_KEY = "gmail_token";
const EXPIRY_KEY = "gmail_token_expiry";

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
