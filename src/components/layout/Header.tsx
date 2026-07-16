import { useState, useRef, useEffect } from "react";
import { Bell, RefreshCw, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAM } from "@/context/AMContext";
import { formatDate } from "@/lib/utils";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const navigate = useNavigate();
  const { orgAlerts, liveMeta } = useAM();
  const [showAlerts, setShowAlerts] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Bell shows actionable signals: high-urgency verified org alerts.
  // (The old header also counted account.isMIA — a static seed field that
  // flagged nearly the whole book; engagement gaps now live in Top Blockers,
  // computed from real Gmail activity.)
  const urgent = orgAlerts
    .filter(a => a.urgency === "high")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  useEffect(() => {
    if (!showAlerts) return;
    const close = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setShowAlerts(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showAlerts]);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 bg-background/90 backdrop-blur border-b border-border">
      <div>
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground hidden sm:block">
          Week of {formatDate(new Date())}
        </span>
        <span className="text-[10px] text-muted-foreground hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full border border-border bg-secondary">
          <span className="w-1.5 h-1.5 rounded-full bg-v-teal inline-block" />
          {liveMeta ? <>Data through {formatDate(`${liveMeta.dataThrough}T12:00:00`)} · BigQuery</> : "BigQuery"}
        </span>

        {urgent.length > 0 && (
          <button
            onClick={() => navigate("/intel")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-v-red/10 text-v-red text-xs font-medium animate-pulse hover:bg-v-red/20 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-v-red" />
            {urgent.length} urgent signal{urgent.length > 1 ? "s" : ""}
          </button>
        )}

        <button
          title="Reload live data"
          onClick={() => window.location.reload()}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        <div className="relative" ref={panelRef}>
          <button
            title="Notifications"
            onClick={() => setShowAlerts(v => !v)}
            className="relative p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <Bell className="w-3.5 h-3.5" />
            {urgent.length > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-v-red" />
            )}
          </button>

          {showAlerts && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-background shadow-lg overflow-hidden animate-fade-in">
              <div className="px-4 py-2.5 border-b border-border text-xs font-semibold text-foreground">
                High-urgency signals
              </div>
              {urgent.length === 0 ? (
                <p className="px-4 py-4 text-xs text-muted-foreground">Nothing urgent right now.</p>
              ) : (
                urgent.slice(0, 5).map(a => (
                  <button
                    key={a.id}
                    onClick={() => { setShowAlerts(false); navigate(`/outreach?account=${a.accountId}&intel=${a.id}`); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-secondary/50 transition-colors border-b border-border last:border-b-0"
                  >
                    <p className="text-xs font-semibold text-foreground">{a.accountName}</p>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">{a.title}</p>
                  </button>
                ))
              )}
              <button
                onClick={() => { setShowAlerts(false); navigate("/intel"); }}
                className="w-full flex items-center justify-center gap-1 px-4 py-2 text-xs text-v-blue hover:bg-secondary/50 transition-colors"
              >
                View all signals <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
