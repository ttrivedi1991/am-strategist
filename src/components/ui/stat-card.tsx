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
        "rounded-xl border border-border bg-card p-5 flex flex-col gap-3 transition-all",
        onClick && "cursor-pointer hover:shadow-md hover:border-primary/30",
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className={cn("w-8 h-8 rounded-lg bg-secondary flex items-center justify-center", iconColor)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
        {(change !== undefined || changeLabel) && (
          <div className="flex items-center gap-1 mt-1">
            {isPositive && <TrendingUp className="w-3 h-3 text-v-green" />}
            {isNegative && <TrendingDown className="w-3 h-3 text-v-red" />}
            {!isPositive && !isNegative && <Minus className="w-3 h-3 text-muted-foreground" />}
            <span className={cn("text-xs font-medium", isPositive ? "text-v-green" : isNegative ? "text-v-red" : "text-muted-foreground")}>
              {change !== undefined ? `${change > 0 ? "+" : ""}${change}%` : ""} {changeLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
