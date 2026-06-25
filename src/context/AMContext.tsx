import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { auth, db, googleProvider, ALLOWED_DOMAIN } from "@/lib/firebase";
import { setAppData } from "@/data/store";
import type {
  AMProfile, Account, OrgAlert, AppData, LiveMeta, AIAdoptionData, PartnerBillingDocs, BillingAdjustment,
} from "@/data/types";

interface AMContextValue {
  // auth
  user: User | null;
  loading: boolean;       // true while auth resolves or data loads
  authError: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  // role: "am" = an Account Manager (full access incl. Commission);
  // "csm" = read-only viewer (e.g. Brady) — Commission page hidden.
  role: "am" | "csm";
  // data (valid once loading === false and authError === null)
  selectedAM: AMProfile;
  setSelectedAM: (am: AMProfile) => void;
  roster: AMProfile[];
  accounts: Account[];
  orgAlerts: OrgAlert[];
  liveMeta: LiveMeta | null;
  billingDocs: Record<string, PartnerBillingDocs>;
  billingDocsMtd: Record<string, PartnerBillingDocs>;
  aiAdoption: AIAdoptionData;
  anthropicApiKey: string | null;
}

const AMContext = createContext<AMContextValue | null>(null);
const SELECTED_KEY = "am_selected_id";

// liveMerge logic, moved here so it runs on Firestore-loaded data (no bundled data).
function withLiveTrend(am: AMProfile, accounts: Account[]): AMProfile {
  const labels = accounts.reduce(
    (best, a) => (a.revenueHistory.length > best.length ? a.revenueHistory.map(h => h.week) : best),
    [] as string[],
  );
  if (!labels.length) return am;
  const revenueTrend = labels.map(week => ({
    week,
    mrr: Math.round(accounts.reduce((s, a) => s + (a.revenueHistory.find(h => h.week === week)?.mrr ?? 0), 0)),
  }));
  return { ...am, revenueTrend };
}

export function AMProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [data, setData] = useState<AppData | null>(null);
  const [selectedId, setSelectedId] = useState<string>(() => localStorage.getItem(SELECTED_KEY) ?? "");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthError(null);
      if (!u) { setUser(null); setData(null); setLoading(false); return; }
      // Domain gate (UX-level; Firestore rules are the real enforcement).
      if (!u.email || !u.email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
        await signOut(auth);
        setAuthError(`Access is limited to @${ALLOWED_DOMAIN} accounts.`);
        setUser(null); setLoading(false);
        return;
      }
      setUser(u);
      setLoading(true);
      try {
        const appData = await loadAppData();
        setAppData(appData);
        setData(appData);
      } catch (e: any) {
        // Authenticated but Firestore denied reads → not on the AM allowlist.
        setAuthError(
          "You're signed in, but this dashboard's data is restricted to assigned Account Managers. Contact Tanmay to be added."
        );
        await signOut(auth);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  async function loginWithGoogle() {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      if (e?.code !== "auth/popup-closed-by-user" && e?.code !== "auth/cancelled-popup-request") {
        setAuthError("Sign-in failed. Try again.");
      }
    }
  }

  async function logout() {
    await signOut(auth);
    setData(null);
    setUser(null);
  }

  const roster = data?.roster ?? [];
  // Role: a roster member (matched by email) is an AM; any other authorized
  // signed-in user (read-allowed by firestore.rules, e.g. a technical CSM) is a
  // read-only viewer who shouldn't see the Commission page.
  const isRosterAM = roster.some(a => a.email.toLowerCase() === user?.email?.toLowerCase());
  const role: "am" | "csm" = isRosterAM ? "am" : "csm";
  const defaultId = roster.find(a => a.email.toLowerCase() === user?.email?.toLowerCase())?.id
    ?? roster[0]?.id ?? "";
  const activeId = roster.some(a => a.id === selectedId) ? selectedId : defaultId;

  function setSelectedAM(am: AMProfile) {
    localStorage.setItem(SELECTED_KEY, am.id);
    setSelectedId(am.id);
  }

  const selectedAM = roster.find(a => a.id === activeId) ?? ({} as AMProfile);
  const allAccounts = data?.accounts ?? [];
  const accounts = allAccounts.filter(a => (a.amId ?? "tanmay") === activeId);
  const liveAM = withLiveTrend(selectedAM, accounts);
  const orgAlerts = (data?.orgAlerts ?? []).filter(a => accounts.some(acc => acc.id === a.accountId));

  return (
    <AMContext.Provider value={{
      user, loading, authError, loginWithGoogle, logout, role,
      selectedAM: liveAM, setSelectedAM, roster,
      accounts, orgAlerts,
      liveMeta: data?.liveMeta ?? null,
      billingDocs: data?.billingDocs ?? {},
      billingDocsMtd: data?.billingDocsMtd ?? {},
      aiAdoption: data?.aiAdoption ?? {},
      anthropicApiKey: data?.anthropicApiKey ?? null,
    }}>
      {children}
    </AMContext.Provider>
  );
}

async function loadAppData(): Promise<AppData> {
  const [accountsSnap, rosterSnap, alertsSnap, liveDoc, aiDoc, bdDoc, bdMtdDoc, adjDoc, configDoc] = await Promise.all([
    getDocs(collection(db, "accounts")),
    getDocs(collection(db, "roster")),
    getDocs(collection(db, "orgAlerts")),
    getDoc(doc(db, "meta", "live")),
    getDoc(doc(db, "meta", "aiAdoption")),
    getDoc(doc(db, "meta", "billingDocs")),
    getDoc(doc(db, "meta", "billingDocsMtd")),
    getDoc(doc(db, "meta", "billingAdjustments")),
    getDoc(doc(db, "meta", "config")),
  ]);
  const roster = rosterSnap.docs.map(d => d.data() as AMProfile).sort((a, b) => a.id.localeCompare(b.id));
  return {
    accounts: accountsSnap.docs.map(d => d.data() as Account),
    roster,
    orgAlerts: alertsSnap.docs.map(d => d.data() as OrgAlert),
    liveMeta: liveDoc.data() as LiveMeta,
    aiAdoption: (aiDoc.data()?.data ?? {}) as AIAdoptionData,
    billingDocs: (bdDoc.data()?.byAgid ?? {}) as Record<string, PartnerBillingDocs>,
    billingDocsMtd: (bdMtdDoc.data()?.byAgid ?? {}) as Record<string, PartnerBillingDocs>,
    billingAdjustments: (adjDoc.data()?.items ?? []) as BillingAdjustment[],
    anthropicApiKey: (configDoc.data()?.anthropicApiKey as string | undefined) ?? null,
  };
}

export function useAM() {
  const ctx = useContext(AMContext);
  if (!ctx) throw new Error("useAM must be used within AMProvider");
  return ctx;
}
