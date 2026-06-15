// Type-only module — NO data. Types are erased at build time, so importing
// from here keeps the public bundle free of confidential partner data.
// The actual data lives in Firestore (loaded at runtime by AMContext) and in
// mock.ts / live.ts / billingDocs.ts, which are used ONLY by the seed script
// (scripts/seed-firestore.mjs) and never imported by bundled app code.

export type Vertical =
  | "PropTech"
  | "FinTech"
  | "Telecom"
  | "Industry Association"
  | "Digital Marketing"
  | "Multifamily Tech"
  | "Automotive Tech"
  | "Hospitality Tech"
  | "Healthcare Tech"
  | "Home Services Tech"
  | "Data & Analytics"
  | "Franchise Tech"
  | "Domain & Hosting"
  | "AI / SaaS"
  | "Agency"
  | "Media & Publishing";

export type AccountHealth = "healthy" | "at-risk" | "churning" | "champion";
export type AIAdoptionTier = "none" | "basic" | "growth" | "power";

export interface Account {
  amId?: string; // defaults to "tanmay" if omitted
  id: string;
  name: string;
  internalId: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  vertical: Vertical;
  country: string;
  mrr: number;
  mrrPrev: number;
  arr: number;
  health: AccountHealth;
  aiAdoption: AIAdoptionTier;
  lastMeeting: string;
  lastActivity: string;
  products: string[];
  productBreakdown: Array<{ name: string; category: string; mrr: number; commissionable: number; quantity?: number }>;
  website: string;
  notes: string;
  isMIA: boolean;
  onboardedDate: string;
  revenueHistory: { week: string; mrr: number }[];
  agid?: string; // Vendasta vmf_account_group_id from dim_current_partner
  mtdBilling?: { week: string; mrr: number }; // current-month billings through last business day
}

export interface AMProfile {
  id: string;
  name: string;
  email: string;
  title: string;
  avatar: string;
  quota: number;
  achievedMRR: number;
  revenueTrend: { week: string; mrr: number }[];
  weeklyActions: { id: number; priority: string; account: string; action: string; due: string }[];
}

export interface OrgAlert {
  id: string;
  accountId: string;
  accountName: string;
  type: "acquisition" | "leadership" | "expansion" | "gtm-change" | "funding" | "award";
  title: string;
  summary: string;
  source: string;
  date: string;
  urgency: "high" | "medium" | "low";
  actionSuggestion: string;
}

export interface BillingDoc {
  id: string;
  date: string;
  amount: number;
  lineCount: number;
}

export interface PartnerBillingDocs {
  partnerName: string;
  month: string;
  invoiceCount: number;
  billed: number;
  credits: number;
  topInvoices: BillingDoc[];
  creditNotes: BillingDoc[];
}

export interface LiveMeta {
  generatedAt: string;
  dataThrough: string;
  mtdLabel: string;
  productMonth: string; // month the product breakdown reflects (last full month)
  // In-month pace keyed by roster AM id, so each AM's projection uses their own.
  mtdPaceByAm: Record<string, { spanDays: number; current: number; priorSameSpan: number; priorMonthLabel: string }>;
}

export type MtdPace = LiveMeta["mtdPaceByAm"][string];

export type AIAdoptionData = Record<string, { month: string; withAI: number; noAI: number }[]>;

// One-time billing artifacts normalized for the commission projection (e.g. a
// credit that reverses a prior-month overcharge). Confidential (names a partner
// + credit note), so it lives in Firestore, not the bundle.
export interface BillingAdjustment {
  account: string;
  week: string;
  amount: number;
  reason: string;
}

// Aggregate the app loads from Firestore at runtime.
export interface AppData {
  roster: AMProfile[];
  accounts: Account[];
  orgAlerts: OrgAlert[];
  aiAdoption: AIAdoptionData;
  liveMeta: LiveMeta;
  billingDocs: Record<string, PartnerBillingDocs>;
  billingDocsMtd: Record<string, PartnerBillingDocs>;
  billingAdjustments: BillingAdjustment[];
}
