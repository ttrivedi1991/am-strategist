import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: "up" | "down" | "flat";
  className?: string;
  onClick?: () => void;
}

export function StatCard({ label, value, change, changeLabel, icon: Icon, iconColor = "text-primary", trend, className, onClick }: StatCardProps) {
  const isPositive = (trend === "up") || (change !== undefined && change > 0);
  const isNegative = (trend === "down") || (change !== undefined && change < 0);

  return (
    <div
      className={cn(
        "group rounded-2xl border border-border/70 bg-card p-5 flex flex-col gap-4 shadow-sm transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-border",
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className={cn("w-9 h-9 rounded-xl bg-secondary/70 flex items-center justify-center transition-colors group-hover:bg-secondary", iconColor)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className="text-[28px] leading-none font-semibold text-foreground tracking-tight tnum">{value}</p>
        {(change !== undefined || changeLabel) && (
          <div className="flex items-center gap-1.5 mt-2.5">
            {isPositive && <TrendingUp className="w-3.5 h-3.5 text-v-green" />}
            {isNegative && <TrendingDown className="w-3.5 h-3.5 text-v-red" />}
            {!isPositive && !isNegative && <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
            <span className={cn("text-xs font-medium", isPositive ? "text-v-green" : isNegative ? "text-v-red" : "text-muted-foreground")}>
              {change !== undefined ? `${change > 0 ? "+" : ""}${change}%` : ""} {changeLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
