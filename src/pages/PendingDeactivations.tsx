import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAM } from "@/context/AMContext";
import { PENDING_DEACTIVATIONS } from "@/data/mock";
import { formatCurrency } from "@/lib/utils";
import {
  AlertTriangle, Clock, TrendingDown, DollarSign, CalendarX, ChevronDown, ChevronUp
} from "lucide-react";

const TODAY = new Date("2026-04-29");

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const healthVariant = {
  champion: "success",
  healthy: "info",
  "at-risk": "warning",
  churning: "danger",
} as const;

export default function PendingDeactivations() {
  const { accounts } = useAM();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Build account-level groups with real data only
  const accountGroups = accounts
    .filter(a => PENDING_DEACTIVATIONS[a.id]?.length > 0)
    .map(a => {
      const deactivations = PENDING_DEACTIVATIONS[a.id].map(d => ({
        ...d,
        daysRemaining: daysUntil(d.activeUntil),
      }));
      const earliestDays = Math.min(...deactivations.map(d => d.daysRemaining));
      const totalMRR = deactivations.reduce((s, d) => s + d.mrr, 0);
      return {
        accountId: a.id,
        accountName: a.name,
        agid: a.agid,
        contactName: a.contactName,
        contactTitle: a.contactTitle,
        health: a.health,
        deactivations,
        earliestDays,
        totalMRR,
      };
    })
    .sort((a, b) => a.earliestDays - b.earliestDays);

  const allProducts = accountGroups.flatMap(g => g.deactivations);
  const totalMRRAtRisk = allProducts.reduce((s, d) => s + d.mrr, 0);
  const critical = accountGroups.filter(g => g.earliestDays <= 7);
  const thisMonth = accountGroups.filter(g => g.earliestDays > 7 && g.earliestDays <= 30);
  const later = accountGroups.filter(g => g.earliestDays > 30);

  const urgencyBadge = (days: number) => {
    if (days <= 0)  return <Badge variant="danger">Expired</Badge>;
    if (days <= 7)  return <Badge variant="danger">{days}d left</Badge>;
    if (days <= 30) return <Badge variant="warning">{days}d left</Badge>;
    return <Badge variant="info">{days}d left</Badge>;
  };

  const AccountCard = ({ group }: { group: typeof accountGroups[number] }) => {
    const isExpanded = expanded === group.accountId;
    return (
      <div
        className="rounded-xl border border-border bg-card overflow-hidden cursor-pointer hover:border-primary/20 transition-all"
        onClick={() => setExpanded(isExpanded ? null : group.accountId)}
      >
        {/* Header row */}
        <div className="flex items-center gap-4 p-4">
          {/* Urgency stripe */}
          <div className={`w-1 self-stretch rounded-full shrink-0 ${
            group.earliestDays <= 7 ? "bg-v-red" :
            group.earliestDays <= 30 ? "bg-v-amber" : "bg-v-blue"
          }`} />

          {/* Account info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{group.accountName}</span>
              <Badge variant={healthVariant[group.health]} className="text-[10px]">{group.health}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {group.contactName}
              {group.contactTitle && group.contactTitle !== "TBD — look up in CRM" && (
                <span className="text-muted-foreground/60"> · {group.contactTitle}</span>
              )}
            </p>
          </div>

          {/* Summary */}
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-v-red">{formatCurrency(group.totalMRR)}/mo</p>
            <p className="text-xs text-muted-foreground">{group.deactivations.length} product{group.deactivations.length !== 1 ? "s" : ""}</p>
          </div>

          {/* Urgency + chevron */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {urgencyBadge(group.earliestDays)}
            {isExpanded
              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            }
          </div>
        </div>

        {/* Expanded detail */}
        {isExpanded && (
          <div className="border-t border-border bg-secondary/20 px-5 py-4 space-y-3">
            {/* AGID + account identifier */}
            <div className="flex flex-wrap gap-4 text-xs">
              <div>
                <span className="text-muted-foreground uppercase tracking-wide text-[10px] font-semibold">AGID</span>
                <p className="font-mono font-medium text-foreground mt-0.5">
                  {group.agid ?? "—"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground uppercase tracking-wide text-[10px] font-semibold">Customer</span>
                <p className="font-medium text-foreground mt-0.5">{group.accountName}</p>
              </div>
            </div>

            {/* Product rows */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-4 gap-2 px-3 py-1.5 bg-secondary/60 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                <span className="col-span-2">Product Cancelled</span>
                <span>Cancelled</span>
                <span>Active Until</span>
              </div>
              {group.deactivations.map((d, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 px-3 py-2.5 border-t border-border text-xs items-center">
                  <div className="col-span-2">
                    <p className="font-medium text-foreground truncate">{d.productName}</p>
                    <p className="text-v-red font-semibold text-[11px]">{formatCurrency(d.mrr)}/mo</p>
                  </div>
                  <span className="text-muted-foreground">{formatDate(d.cancelledOn)}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">{formatDate(d.activeUntil)}</span>
                    {urgencyBadge(d.daysRemaining)}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-4 gap-2 px-3 py-2 border-t border-border bg-secondary/40 text-xs font-semibold">
                <span className="col-span-2 text-muted-foreground">Total MRR at Risk</span>
                <span className="col-span-2 text-v-red">{formatCurrency(group.totalMRR)}/mo</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const Section = ({
    title, icon: Icon, color, groups, emptyMsg,
  }: {
    title: string;
    icon: React.ElementType;
    color: string;
    groups: typeof accountGroups;
    emptyMsg: string;
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center gap-1.5 ${color}`}>
          <Icon className="w-3.5 h-3.5" />
          {title}
          {groups.length > 0 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {groups.length} account{groups.length !== 1 ? "s" : ""} · {formatCurrency(groups.reduce((s, g) => s + g.totalMRR, 0))}/mo
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {groups.length === 0
          ? <p className="text-xs text-muted-foreground text-center py-4">{emptyMsg}</p>
          : groups.map(g => <AccountCard key={g.accountId} group={g} />)
        }
      </CardContent>
    </Card>
  );

  return (
    <div className="animate-fade-in">
      <Header
        title="Pending Deactivations"
        subtitle={`${allProducts.length} products cancelling · ${formatCurrency(totalMRRAtRisk)}/mo at risk across ${accountGroups.length} accounts`}
      />

      <div className="p-6 space-y-6">

        {/* Critical banner */}
        {critical.length > 0 && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-v-red/5 border border-v-red/20">
            <AlertTriangle className="w-4 h-4 text-v-red mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {critical.reduce((s, g) => s + g.deactivations.length, 0)} product{critical.reduce((s, g) => s + g.deactivations.length, 0) !== 1 ? "s" : ""} deactivating within 7 days —{" "}
                {formatCurrency(critical.reduce((s, g) => s + g.totalMRR, 0))}/mo
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Final billing window. Once the renewal date passes, revenue is gone and cannot be recovered.
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total MRR at Risk", value: formatCurrency(totalMRRAtRisk), sub: "across all pending", icon: DollarSign, color: "text-v-red" },
            { label: "Products Cancelling", value: String(allProducts.length), sub: "in deactivation queue", icon: CalendarX, color: "text-v-amber" },
            { label: "Accounts Affected", value: String(accountGroups.length), sub: "need immediate action", icon: TrendingDown, color: "text-foreground" },
            { label: "Critical (≤7 days)", value: String(critical.length), sub: `${formatCurrency(critical.reduce((s, g) => s + g.totalMRR, 0))}/mo expiring`, icon: AlertTriangle, color: "text-v-red" },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
            </div>
          ))}
        </div>

        <Section title="Critical — Expiring within 7 days" icon={AlertTriangle} color="text-v-red" groups={critical} emptyMsg="No critical deactivations" />
        <Section title="This Month — Expiring within 30 days" icon={Clock} color="text-v-amber" groups={thisMonth} emptyMsg="No deactivations this month" />
        <Section title="Coming Up — Expiring after 30 days" icon={CalendarX} color="text-v-blue" groups={later} emptyMsg="No deactivations beyond 30 days" />

        <p className="text-[11px] text-muted-foreground text-center pb-2">
          Data sourced from Partner Center cancellation queue · Last synced Apr 29, 2026
        </p>
      </div>
    </div>
  );
}
