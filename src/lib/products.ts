import type { Account } from "@/data/types";

// Name-based AI product classifier. The warehouse `ai_product_ind` flag is
// unreliable (only 11 products flagged platform-wide; false even on Reputation
// AI Pro and Vibe), so AI products are identified by name against the live
// productBreakdown. Covers the AI families (Reputation AI, Conversations AI,
// AI Receptionist/Employee/Voice, etc.) and Vibe — Vendasta's AI app/website
// builder (SKUs: "Vibe (Beta)", "Vibe (Beta) Pro/Standard/Free",
// "Vibe N credits / month", "Vibe Coding", "Vibe-Live Streaming").
export function isAIProduct(name: string): boolean {
  const n = name.toLowerCase();
  return /\bai\b/.test(n) || /\bvibe\b/.test(n);
}

// An account's active AI products, from live billing (mrr > 0).
export function aiProductsOf(a: Account) {
  return a.productBreakdown.filter(p => p.mrr > 0 && isAIProduct(p.name));
}

export function hasAI(a: Account): boolean {
  return aiProductsOf(a).length > 0;
}
