import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString()}`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function daysSince(date: Date | string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

export function pctChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

// QoQ baseline = prior-quarter close (Mar 2026 for Q2). The commission plan
// measures quarterly growth as monthly deltas summed, which telescopes to
// current close − prior-quarter close. Looks up by label so it's robust to
// array length changes.
export const QOQ_BASELINE_LABEL = "Mar 2026";
export function getQoQBaseMRR(history: { week: string; mrr: number }[]): number {
  return history.find(h => h.week === "Mar 26")?.mrr ?? history[4]?.mrr ?? 0;
}

// Latest-month billings from the history array — single source of truth for
// "current month" so cards and trend charts never disagree.
export function getLatestMRR(history: { week: string; mrr: number }[]): number {
  return history[history.length - 1]?.mrr ?? 0;
}

// Commissionable dollars/mo = billings × inclusion rate, summed across active products.
export function commissionableMRR(breakdown: { mrr: number; commissionable: number }[]): number {
  return breakdown.reduce((s, p) => s + (p.mrr > 0 ? p.commissionable : 0), 0);
}

// "May 26" (data month key) → "May 2026" for display, so it never reads as a calendar date.
export function formatMonthLabel(week: string): string {
  return week.replace(/^([A-Za-z]{3}) (\d{2})$/, "$1 20$2");
}
