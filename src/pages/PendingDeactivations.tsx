import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAM } from "@/context/AMContext";
import { PENDING_DEACTIVATIONS } from "@/data/mock";
import { formatCurrency } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, Clock, TrendingDown, DollarSign, ArrowRight, CalendarX
} from "lucide-react";

const TODAY = new Date("2026-04-29");

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  return Math.ceil((d.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24));
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
  const navigate = useNavigate();
  const { accounts } = useAM();

  // Merge deactivations with account data
  const allPending = accounts
    .filter(a => PENDING_DEACTIVATIONS[a.id]?.length > 0)
    .flatMap(a =>
      PENDING_DEACTIVATIONS[a.id].map(d => ({
        ...d,
        accountId: a.id,
        accountName: a.name,
        contactName: a.contactName,
        contactTitle: a.contactTitle,
        health: a.health,
        daysRemaining: daysUntil(d.activeUntil),
      }))
    )
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const totalMRR = allPending.reduce((s, d) => s + d.mrr, 0);
  const accountsAffected = new Set(allPending.map(d => d.accountId)).size;
  const critical = allPending.filter(d => d.daysRemaining <= 7);
  const thisMonth = allPending.filter(d => d.daysRemaining > 7 && d.daysRemaining <= 30);
  const later = allPending.filter(d => d.daysRemaining > 30);

  const urgencyBadge = (days: number) => {
    if (days <= 0)  return <Badge variant="danger">Expired</Badge>;
    if (days <= 7)  return <Badge variant="danger">{days}d left</Badge>;
    if (days <= 30) return <Badge variant="warning">{days}d left</Badge>;
    return <Badge variant="info">{days}d left</Badge>;
  };

  const DeactivationRow = ({ item }: { item: typeof allPending[number] }) => (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-colors">
      {/* Urgency stripe */}
      <div className={`w-1 self-stretch rounded-full shrink-0 ${
        item.daysRemaining <= 7 ? "bg-v-red" :
        item.daysRemaining <= 30 ? "bg-v-amber" : "bg-v-blue"
      }`} />

      {/* Account info */}
      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{item.accountName}</span>
            <Badge variant={healthVariant[item.health]} className="text-[10px]">{item.health}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {item.contactName}
            {item.contactTitle && item.contactTitle !== "TBD — look up in CRM" && (
              <span className="text-muted-foreground/60"> · {item.contactTitle}</span>
            )}
          </p>
        </div>

        {/* Product */}
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Product</p>
          <p className="text-sm font-medium text-foreground truncate">{item.productName}</p>
          <p className="text-xs text-v-red font-semibold mt-0.5">{formatCurrency(item.mrr)}/mo at risk</p>
        </div>

        {/* Timeline */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarX className="w-3 h-3 shrink-0" />
            <span>Cancelled {formatDate(item.cancelledOn)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3 shrink-0" />
            <span>Active until {formatDate(item.activeUntil)}</span>
          </div>
          <div className="mt-0.5">{urgencyBadge(item.daysRemaining)}</div>
        </div>
      </div>

      {/* Action */}
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 self-center"
        onClick={() => navigate(`/outreach?account=${item.accountId}`)}
      >
        Save <ArrowRight className="w-3 h-3" />
      </Button>
    </div>
  );

  const Section = ({
    title, icon: Icon, color, items, emptyMsg
  }: {
    title: string;
    icon: React.ElementType;
    color: string;
    items: typeof allPending;
    emptyMsg: string;
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center gap-1.5 ${color}`}>
          <Icon className="w-3.5 h-3.5" />
          {title}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {items.length > 0
              ? `${items.length} product${items.length !== 1 ? "s" : ""} · ${formatCurrency(items.reduce((s, d) => s + d.mrr, 0))}/mo`
              : emptyMsg
            }
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">{emptyMsg}</p>
        ) : (
          items.map((item, i) => <DeactivationRow key={`${item.accountId}-${i}`} item={item} />)
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="animate-fade-in">
      <Header
        title="Pending Deactivations"
        subtitle={`${allPending.length} products cancelling · ${formatCurrency(totalMRR)}/mo at risk across ${accountsAffected} accounts`}
      />

      <div className="p-6 space-y-6">

        {/* Critical banner */}
        {critical.length > 0 && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-v-red/5 border border-v-red/20">
            <AlertTriangle className="w-4 h-4 text-v-red mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {critical.length} product{critical.length !== 1 ? "s" : ""} deactivating within 7 days —{" "}
                {formatCurrency(critical.reduce((s, d) => s + d.mrr, 0))}/mo
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                These cancellations are in their final billing window. Reach out now — once the renewal date passes, revenue is gone.
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total MRR at Risk", value: formatCurrency(totalMRR), sub: "across all pending", icon: DollarSign, color: "text-v-red" },
            { label: "Products Cancelling", value: String(allPending.length), sub: "in deactivation queue", icon: CalendarX, color: "text-v-amber" },
            { label: "Accounts Affected", value: String(accountsAffected), sub: "need immediate action", icon: TrendingDown, color: "text-v-orange" },
            { label: "Critical (≤7 days)", value: String(critical.length), sub: `${formatCurrency(critical.reduce((s, d) => s + d.mrr, 0))}/mo expiring`, icon: AlertTriangle, color: "text-v-red" },
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

        {/* Critical — ≤7 days */}
        <Section
          title="Critical — Expiring within 7 days"
          icon={AlertTriangle}
          color="text-v-red"
          items={critical}
          emptyMsg="No critical deactivations"
        />

        {/* This Month — 8–30 days */}
        <Section
          title="This Month — Expiring within 30 days"
          icon={Clock}
          color="text-v-amber"
          items={thisMonth}
          emptyMsg="No deactivations this month"
        />

        {/* Later — 30+ days */}
        <Section
          title="Coming Up — Expiring after 30 days"
          icon={CalendarX}
          color="text-v-blue"
          items={later}
          emptyMsg="No deactivations beyond 30 days"
        />

        <p className="text-[11px] text-muted-foreground text-center pb-2">
          Data sourced from Partner Center cancellation queue · Last synced Apr 29, 2026
        </p>
      </div>
    </div>
  );
}
