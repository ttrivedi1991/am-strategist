import { createContext, useContext, useState, type ReactNode } from "react";
import { ACCOUNTS, ORG_ALERTS, AM_ROSTER, type AMProfile, type Account, type OrgAlert } from "@/data/mock";

interface AMContextValue {
  selectedAM: AMProfile;
  setSelectedAM: (am: AMProfile) => void;
  accounts: Account[];
  orgAlerts: OrgAlert[];
}

const AMContext = createContext<AMContextValue | null>(null);

const STORAGE_KEY = "am_selected_id";

export function AMProvider({ children }: { children: ReactNode }) {
  const [selectedAM, setSelectedAMState] = useState<AMProfile>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return AM_ROSTER.find(a => a.id === saved) ?? AM_ROSTER[0];
  });

  function setSelectedAM(am: AMProfile) {
    localStorage.setItem(STORAGE_KEY, am.id);
    setSelectedAMState(am);
  }

  const accounts = ACCOUNTS.filter(a => (a.amId ?? "tanmay") === selectedAM.id);
  const orgAlerts = ORG_ALERTS.filter(a => {
    const account = accounts.find(acc => acc.id === a.accountId);
    return !!account;
  });

  return (
    <AMContext.Provider value={{ selectedAM, setSelectedAM, accounts, orgAlerts }}>
      {children}
    </AMContext.Provider>
  );
}

export function useAM() {
  const ctx = useContext(AMContext);
  if (!ctx) throw new Error("useAM must be used within AMProvider");
  return ctx;
}
