import { Bell, RefreshCw } from "lucide-react";
import { useAM } from "@/context/AMContext";
import { formatDate } from "@/lib/utils";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { accounts, orgAlerts, liveMeta } = useAM();
  const urgentAlerts = orgAlerts.filter(a => a.urgency === "high").length;
  const miaCount = accounts.filter(a => a.isMIA).length;

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

        {(urgentAlerts > 0 || miaCount > 0) && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-v-red/10 text-v-red text-xs font-medium animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-v-red" />
            {urgentAlerts} urgent · {miaCount} MIA
          </div>
        )}

        <button className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        <button className="relative p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <Bell className="w-3.5 h-3.5" />
          {urgentAlerts > 0 && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-v-red" />
          )}
        </button>
      </div>
    </header>
  );
}
