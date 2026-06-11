import { createContext, useContext, useState, type ReactNode } from "react";
import { ACCOUNTS, ORG_ALERTS, AM_ROSTER, type AMProfile, type Account, type OrgAlert } from "@/data/mock";
import { withLiveBillings, withLiveTrend } from "@/data/liveMerge";

interface AMContextValue {
  selectedAM: AMProfile;
  setSelectedAM: (am: AMProfile) => void;
  accounts: Account[];
  orgAlerts: OrgAlert[];
  isAuthenticated: boolean;
  login: (id: string) => boolean;
  logout: () => void;
}

const AMContext = createContext<AMContextValue | null>(null);

const STORAGE_KEY = "am_selected_id";
const AUTH_KEY = "am_authenticated";

export function AMProvider({ children }: { children: ReactNode }) {
  const [selectedAM, setSelectedAMState] = useState<AMProfile>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return AM_ROSTER.find(a => a.id === saved) ?? AM_ROSTER[0];
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem(AUTH_KEY) === "true";
  });

  function setSelectedAM(am: AMProfile) {
    localStorage.setItem(STORAGE_KEY, am.id);
    setSelectedAMState(am);
  }

  function login(id: string) {
    const am = AM_ROSTER.find(a => a.id === id);
    if (am) {
      setSelectedAM(am);
      setIsAuthenticated(true);
      localStorage.setItem(AUTH_KEY, "true");
      return true;
    }
    return false;
  }

  function logout() {
    setIsAuthenticated(false);
    localStorage.removeItem(AUTH_KEY);
  }

  const accounts = withLiveBillings(ACCOUNTS.filter(a => (a.amId ?? "tanmay") === selectedAM.id));
  const liveAM = withLiveTrend(selectedAM, accounts);
  const orgAlerts = ORG_ALERTS.filter(a => {
    const account = accounts.find(acc => acc.id === a.accountId);
    return !!account;
  });

  return (
    <AMContext.Provider value={{ selectedAM: liveAM, setSelectedAM, accounts, orgAlerts, isAuthenticated, login, logout }}>
      {children}
    </AMContext.Provider>
  );
}

export function useAM() {
  const ctx = useContext(AMContext);
  if (!ctx) throw new Error("useAM must be used within AMProvider");
  return ctx;
}
