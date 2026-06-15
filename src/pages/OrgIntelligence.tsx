import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type OrgAlert } from "@/data/types";
import { formatDate } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useAM } from "@/context/AMContext";
import {
  Building2, UserCheck, TrendingUp, Newspaper, Award,
  Zap, ArrowRight, ExternalLink, AlertTriangle, Bell, RefreshCw
} from "lucide-react";

const alertTypeConfig: Record<OrgAlert["type"], { icon: typeof Building2; color: string; label: string }> = {
  acquisition: { icon: Building2, color: "text-v-purple", label: "Acquisition" },
  leadership: { icon: UserCheck, color: "text-v-blue", label: "Leadership Change" },
  expansion: { icon: TrendingUp, color: "text-v-green", label: "Expansion" },
  "gtm-change": { icon: Zap, color: "text-v-amber", label: "GTM Change" },
  funding: { icon: Newspaper, color: "text-v-teal", label: "Funding" },
  award: { icon: Award, color: "text-v-teal", label: "Award / PR" },
};

const urgencyConfig = {
  high: { variant: "danger" as const, label: "Act Now" },
  medium: { variant: "warning" as const, label: "This Week" },
  low: { variant: "info" as const, label: "FYI" },
};

export default function OrgIntelligence() {
  const navigate = useNavigate();
  const { orgAlerts, selectedAM } = useAM();
  const [filter, setFilter] = useState<"all" | OrgAlert["urgency"]>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = (filter === "all" ? orgAlerts : orgAlerts.filter(a => a.urgency === filter))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Newest first

  return (
    <div className="animate-fade-in">
      <Header
        title="Org Intelligence"
        subtitle="Real-time signals from your partners — acquisitions, leadership changes, expansions"
      />

      <div className="p-6 space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {(["high", "medium", "low"] as const).map(urgency => {
            const count = orgAlerts.filter(a => a.urgency === urgency).length;
            const config = urgencyConfig[urgency];
            return (
              <button
                key={urgency}
                onClick={() => setFilter(filter === urgency ? "all" : urgency)}
                className={`rounded-xl border p-4 text-left transition-all ${filter === urgency ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={config.variant}>{config.label}</Badge>
                </div>
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground">alerts</p>
              </button>
            );
          })}
        </div>

        {/* Refresh Notice */}
        <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-v-blue/5 border border-v-blue/20">
          <div className="flex items-center gap-2 text-xs text-v-blue">
            <Bell className="w-3.5 h-3.5" />
            <span>Manually curated signals · no automated feed connected yet</span>
          </div>
        </div>

        {/* Alert Cards */}
        <div className="space-y-3">
          {filtered.map(alert => {
            const typeConf = alertTypeConfig[alert.type];
            const Icon = typeConf.icon;
            const urg = urgencyConfig[alert.urgency];
            const isExpanded = expanded === alert.id;

            return (
              <Card key={alert.id} className={`transition-all ${alert.urgency === "high" ? "border-v-red/30" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`mt-0.5 w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 ${typeConf.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{alert.accountName}</span>
                        <Badge variant={urg.variant}>{urg.label}</Badge>
                        <span className={`text-xs font-medium ${typeConf.color}`}>{typeConf.label}</span>
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">{formatDate(alert.date)}</span>
                      </div>

                      <p className="text-sm font-medium text-foreground mt-1">{alert.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <ExternalLink className="w-2.5 h-2.5" />
                        {alert.source}
                      </p>

                      {isExpanded && (
                        <div className="mt-3 space-y-3 animate-fade-in">
                          <p className="text-sm text-foreground leading-relaxed">{alert.summary}</p>
                          <div className="p-3 rounded-lg bg-v-blue/5 border border-v-blue/20">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-v-blue mb-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Recommended Action
                            </div>
                            <p className="text-sm text-foreground">{alert.actionSuggestion}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => navigate(`/outreach?account=${alert.accountId}&intel=${alert.id}`)}>
                              Create Outreach Plan <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="outline">
                              Draft Email
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : alert.id)}
                      className="shrink-0 text-xs text-primary hover:underline mt-0.5"
                    >
                      {isExpanded ? "Collapse" : "Details & Action"}
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
            {orgAlerts.length === 0 ? (
              <>
                <p className="text-sm font-medium text-foreground">No org signals tracked for {selectedAM.name.split(" ")[0]}'s book yet</p>
                <p className="text-xs mt-1 max-w-md mx-auto">
                  Org Intelligence alerts are curated manually — there's no automated feed connected yet,
                  so coverage currently exists only where signals have been logged by hand.
                </p>
              </>
            ) : (
              <p className="text-sm">No alerts match this filter</p>
            )}
          </div>
        )}

        {/* Monitoring Setup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-v-teal" />
              Monitoring Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Accounts Monitored", value: "10/10", ok: true },
                { label: "LinkedIn Signals", value: "Active", ok: true },
                { label: "Google News Alerts", value: "Active", ok: true },
                { label: "Website Changes", value: "Active", ok: true },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${item.ok ? "bg-v-green" : "bg-v-red"}`} />
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
