import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, getQoQBaseMRR, commissionableMRR, daysSince, recentDeltaMRR, formatMonthLabel } from "@/lib/utils";
import { useAM } from "@/context/AMContext";
import type { Account, OrgAlert } from "@/data/types";
import {
  Send, Mail, Calendar, Copy, CheckCircle2,
  ChevronDown, ChevronRight, Clock, Phone, DollarSign,
  TrendingUp, TrendingDown, ExternalLink, Zap,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Situation = "mia" | "declining" | "atRisk" | "champion" | "stable";

interface CallPrep {
  opening: string;
  questions: string[];
  angles: string[];
  close: string;
}

interface OutreachStep {
  day: number;
  channel: "email" | "gchat" | "call" | "linkedin";
  subject?: string;
  body?: string;
  action: string;
  callPrep?: CallPrep;
  note?: string;
}

interface AccountCommissionContext {
  latestLabel: string;
  latestMRR: number;
  qoqBase: number;
  qoqDelta: number;
  commissionable: number;
  effRate: number;
  topProduct?: { name: string; commissionable: number };
  // 60-day movement (last closed month vs two months prior) — drives the
  // "revenue drops / major fluctuations" thread of the outreach strategy.
  recent: ReturnType<typeof recentDeltaMRR>;
}

// Exact dollars for email copy — formatCurrency's "$8.8K" reads like a
// dashboard, not like a person who looked at the account.
function exactCurrency(v: number): string {
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

// What the partner actually runs with us, from the live product breakdown
// (not just AI SKUs) — the "what do they use Vendasta for" thread.
function usageSummary(account: Account): string | null {
  const lines = account.productBreakdown
    .filter(p => p.mrr > 0)
    .sort((a, b) => b.mrr - a.mrr);
  if (lines.length === 0) return null;
  const top = lines.slice(0, 2).map(p => p.name.trim());
  return lines.length > 2
    ? `${top.join(" and ")}, plus ${lines.length - 2} other lines`
    : top.join(top.length > 1 ? " and " : "");
}

// One factual sentence about the last 60 days of billings, or null when the
// movement is too small to be worth naming. `direction` lets sequences pick
// emails that only make sense one way.
function movementSentence(ctx: AccountCommissionContext): { text: string; direction: "up" | "down" } | null {
  const r = ctx.recent;
  if (!r || r.from === 0) return null;
  const pct = Math.abs(r.delta / r.from);
  if (Math.abs(r.delta) < 500 || pct < 0.05) return null;
  const from = `${exactCurrency(r.from)} in ${formatMonthLabel(r.fromLabel)}`;
  const to = `${exactCurrency(r.to)} in ${formatMonthLabel(r.toLabel)}`;
  return r.delta < 0
    ? { text: `billings moved from ${from} to ${to}`, direction: "down" }
    : { text: `billings grew from ${from} to ${to}`, direction: "up" };
}

// Roadmap thread: Brendan King's March 20 "Strategic Discussion: 2026 AI
// Roadmap" email is the shared context every partner already has; the Q3
// launches are from the current P2 launch plan.
const ROADMAP_REF = "Brendan's March 20 note on the 2026 AI roadmap";
const ROADMAP_Q3 = "AI Social Media Manager and AI Blogger both launch this quarter";

// ─── Vertical context map ──────────────────────────────────────────────────────

const VERTICAL_CONTEXT: Record<string, { smbs: string; theme: string; aiAngle: string }> = {
  "PropTech": {
    smbs: "property management companies and real estate firms",
    theme: "tenant acquisition and online reputation",
    aiAngle: "Reputation AI Pro is the highest-leverage product for property managers — review response time directly affects listing rankings",
  },
  "Telecom": {
    smbs: "SMBs on your platform",
    theme: "AI services as a revenue layer on top of connectivity",
    aiAngle: "Conversations AI and AI Receptionist bundle naturally with existing connectivity products — no new selling motion required",
  },
  "FinTech": {
    smbs: "financial advisors, lenders, and brokerages",
    theme: "local trust and referral pipeline",
    aiAngle: "Reputation Management and Local SEO are the core play — trust is the only purchase driver in financial services",
  },
  "Digital Marketing": {
    smbs: "local businesses across verticals",
    theme: "AI product margins and client retention",
    aiAngle: "Agencies offering AI as a service are retaining clients at a significantly higher rate — it becomes part of the managed service stack",
  },
  "Multifamily Tech": {
    smbs: "apartment communities and property operators",
    theme: "renter acquisition and reputation at scale",
    aiAngle: "Reputation AI Pro drives review velocity at scale — multifamily operators live on star ratings across Google and ApartmentList",
  },
  "Automotive Tech": {
    smbs: "dealerships",
    theme: "online reputation and digital retailing",
    aiAngle: "AI Review Responder at scale — dealerships generate high review volume daily and branded response time is a trust signal",
  },
  "Agency": {
    smbs: "local business clients",
    theme: "AI-powered managed services",
    aiAngle: "The agencies building AI into their core offering are outgrowing those that aren't — Vendasta's white-label suite is designed for this",
  },
  "Industry Association": {
    smbs: "member businesses",
    theme: "member value and retention",
    aiAngle: "Reputation AI and Local SEO as member benefits — helps the association demonstrate ROI and reduces member churn",
  },
  "AI / SaaS": {
    smbs: "SMBs and mid-market customers",
    theme: "AI product depth and platform stickiness",
    aiAngle: "The Vendasta AI roadmap aligns directly with where your customers are moving — I want to walk through the Q2 additions",
  },
  "Hospitality Tech": {
    smbs: "hotels, restaurants, and hospitality operators",
    theme: "review management and direct booking",
    aiAngle: "AI Review Responder — response time is a direct ranking signal on Google and TripAdvisor, and hospitality has the highest review velocity of any SMB category",
  },
  "Home Services Tech": {
    smbs: "contractors, plumbers, and home service operators",
    theme: "reputation and job volume",
    aiAngle: "Reputation AI Pro and AI Receptionist — home services runs almost entirely on referrals and reviews, and AI Receptionist captures the after-hours calls that usually go to voicemail",
  },
  "Data & Analytics": {
    smbs: "SMB and mid-market data users",
    theme: "data-powered marketing and presence",
    aiAngle: "Social Marketing Pro and Local SEO — the data advantage only matters if it drives discoverability and conversion",
  },
  "Franchise Tech": {
    smbs: "franchisees",
    theme: "brand-consistent AI deployment at scale",
    aiAngle: "Reputation AI Pro and Conversations AI roll out cleanly across franchise networks — centralized control, local execution",
  },
  "Domain & Hosting": {
    smbs: "small businesses and web customers",
    theme: "expanding from web presence to AI-powered marketing",
    aiAngle: "Customers already paying for hosting are a natural fit for the next layer — AI website builder (Vibe) and Local SEO are the cleanest add-ons",
  },
  "Healthcare Tech": {
    smbs: "clinics, practices, and healthcare providers",
    theme: "patient acquisition and reputation",
    aiAngle: "Reputation AI Pro and AI Receptionist — patient reviews drive referrals, and AI Receptionist handles after-hours scheduling without a human on call",
  },
  "Media & Publishing": {
    smbs: "media companies, publishers, and local advertisers",
    theme: "advertiser retention and AI content at scale",
    aiAngle: "AI Content Writer and Social Marketing Pro — media partners can offer AI-powered content as part of their advertiser package",
  },
};

function getVertCtx(vertical: string) {
  return VERTICAL_CONTEXT[vertical] ?? {
    smbs: "SMB customers",
    theme: "digital presence and AI adoption",
    aiAngle: "Reputation AI Pro and Conversations AI — broad fit across any SMB base and immediate impact on retention and discovery",
  };
}

// ─── Commission context ────────────────────────────────────────────────────────

function getCommissionContext(account: Account): AccountCommissionContext {
  const latest = account.revenueHistory[account.revenueHistory.length - 1];
  const latestMRR = latest?.mrr ?? account.mrr;
  const qoqBase = getQoQBaseMRR(account.revenueHistory);
  const commissionable = commissionableMRR(account.productBreakdown);
  const breakdownBillings = account.productBreakdown.reduce((s, p) => s + (p.mrr > 0 ? p.mrr : 0), 0);
  const topProduct = [...account.productBreakdown]
    .filter(p => p.mrr > 0)
    .sort((a, b) => b.commissionable - a.commissionable)[0];
  return {
    latestLabel: latest?.week ?? "latest",
    latestMRR,
    qoqBase,
    qoqDelta: latestMRR - qoqBase,
    commissionable,
    effRate: breakdownBillings > 0 ? commissionable / breakdownBillings : 0.95,
    topProduct,
    recent: recentDeltaMRR(account.revenueHistory),
  };
}

// ─── Situation detection ───────────────────────────────────────────────────────

// `override` comes from the URL (?situation=mia), set by Top Blockers when a
// real Gmail-verified engagement gap exists. Never derived from
// account.lastMeeting / isMIA here — those are static seed fields that made
// every account look MIA and pushed everyone into the re-engagement sequence.
function getSituation(account: Account, ctx: AccountCommissionContext, override?: string | null): Situation {
  if (override === "mia") return "mia";
  const recentDelta = ctx.recent?.delta ?? 0;
  if (account.health === "champion" && recentDelta >= 0) return "champion";
  if (recentDelta < -1000) return "declining";
  if (account.health === "at-risk" || account.health === "churning") return "atRisk";
  return "stable";
}

const SITUATION_META: Record<Situation, { label: string; variant: "danger" | "warning" | "success" | "info" | "outline" }> = {
  mia: { label: "Re-engagement", variant: "danger" },
  declining: { label: "Recovery", variant: "warning" },
  atRisk: { label: "At-Risk Save", variant: "warning" },
  champion: { label: "Expansion", variant: "success" },
  stable: { label: "Growth", variant: "info" },
};

// ─── Call prep ─────────────────────────────────────────────────────────────────

function buildCallPrep(account: Account, _ctx: AccountCommissionContext, situation: Situation, topAlert: OrgAlert | null = null): CallPrep {
  const vc = getVertCtx(account.vertical);
  const hasAI = account.products.length > 0;

  const openings: Record<Situation, string> = {
    mia: `"Thanks for making time — I'll keep this to 20 minutes. My goal is to understand where ${account.name} is at right now and share two or three things from the roadmap I think are directly relevant to your ${vc.smbs}."`,
    declining: `"Appreciate the time. I want to start by understanding the full picture from your side before I say anything — so I'll ask a few questions first, then share what I'm seeing."`,
    atRisk: `"Thanks for making time. I want to have a straight conversation about where things stand — not a sales call. So I'll ask you some direct questions, and I'd rather you be direct back."`,
    stable: `"Things look solid from the numbers, so this is a forward-looking call. I want to share what I'm seeing from other ${account.vertical} partners and get your read on whether it applies to ${account.name}."`,
    champion: `"${account.name} is tracking well, which is exactly why I wanted dedicated time — I want to talk about what's next rather than what's working. I'll come with a few specific ideas."`,
  };

  const questionSets: Record<Situation, string[]> = {
    mia: [
      `"How are your ${vc.smbs} actually using the platform day-to-day — what's getting traction, and what isn't?"`,
      `"Has anything changed on your team or strategy side in the last few months that I should factor in?"`,
      `"Is there anything on the Vendasta side that's been a friction point — even a small one?"`,
    ],
    declining: [
      `"Walk me through the last 60 days of billing movement from your side — was that a deliberate change, or something we should investigate together?"`,
      `"Are your ${vc.smbs} actively using what they have, or is there an adoption gap we need to close first?"`,
      `"What does a successful relationship with Vendasta look like for ${account.name} by end of year — same scale, lower, or higher?"`,
    ],
    atRisk: [
      `"If you were evaluating this relationship from scratch today, what would make you recommit?"`,
      `"What do your ${vc.smbs} say about the platform — are we solving the right problem for them?"`,
      `"What's the one thing that, if it changed, would make this a clear yes from your side?"`,
    ],
    stable: [
      `"${account.name} is performing well — is that driven by a few power accounts, or is adoption broad across your base?"`,
      `"What are your ${vc.smbs} asking for that you don't have a great answer to yet?"`,
      `"Where do you want to be a year from now with the Vendasta side of the business — same scale, or expanding?"`,
    ],
    champion: [
      `"What's the playbook that's driven ${account.name}'s results — is it replicable, or specific to how you've deployed?"`,
      `"What would it take to double the deployment by year-end — what's the real constraint?"`,
      `"Are there verticals or customer segments you haven't touched yet that you're planning to move into?"`,
    ],
  };

  const productAngle = hasAI
    ? `${account.products.slice(0, 2).join(" and ")} is already live. ${situation === "declining" ? "Before adding SKUs, the question is whether we're getting full value out of what's deployed." : "The next layer builds directly on that — I want to show you what that looks like."}`
    : `${account.name} doesn't have AI products active yet. That's actually a clean starting point — no migration, no rework. ${vc.aiAngle}.`;

  // Org changes are strategy context, not blockers — they lead the talk track.
  const angles = [productAngle, vc.aiAngle];
  if (topAlert) {
    angles.unshift(`Strategy talk track — ${topAlert.title}: ${topAlert.actionSuggestion}`);
  }

  return {
    opening: openings[situation],
    questions: questionSets[situation],
    angles,
    close: situation === "declining" || situation === "atRisk"
      ? `"Let me put together a short summary of what we discussed and a clear path forward — I'll have it to you by end of week. Does that work?"`
      : `"I'll send a summary after this with two concrete next steps. Should have it to you within a day."`,
  };
}

// ─── Sequence builder ──────────────────────────────────────────────────────────

function intelFirstEmail(first: string, _account: Account, topAlert: OrgAlert, cta: string): string {
  const typeVerb: Record<OrgAlert["type"], string> = {
    acquisition: `I saw the news about ${topAlert.title}`,
    leadership: `I noticed the leadership change — ${topAlert.title}`,
    expansion: `Saw that ${topAlert.title}`,
    "gtm-change": `I noticed ${topAlert.title}`,
    funding: `Congrats on ${topAlert.title}`,
    award: `Saw the recognition — ${topAlert.title}`,
  };
  return `Hello ${first},\n\n${typeVerb[topAlert.type]}. ${topAlert.summary}\n\n${cta}\n\nTanmay`;
}

function buildSequence(account: Account, ctx: AccountCommissionContext, topAlert: OrgAlert | null, situation: Situation): OutreachStep[] {
  const first = account.contactName.split(" ")[0] || account.contactName;
  const vc = getVertCtx(account.vertical);
  const callPrep = buildCallPrep(account, ctx, situation, topAlert);
  const aiList = account.products.slice(0, 2).join(" and ");
  const hasAI = account.products.length > 0;
  // The six threads of the outreach strategy, resolved per account:
  // business (gtmContext) · what they run with us (usage) · AI offer (vc.aiAngle)
  // · roadmap (ROADMAP_*) · 60-day movement (move) · org intel (topAlert).
  const usage = usageSummary(account);
  const move = movementSentence(ctx);
  const biz = account.gtmContext ? `${account.gtmContext}\n\n` : "";

  if (situation === "mia") {
    return [
      {
        day: 1,
        channel: "email",
        action: "Re-engagement",
        subject: topAlert ? `${account.name} — saw the news` : `${account.name} + Vendasta — where we stand`,
        body: topAlert
          ? intelFirstEmail(first, account, topAlert, `That's what prompted this note — I want to make sure we're supporting ${account.name} through it. You run ${usage ?? "the Vendasta platform"} with us today, and parts of this quarter's roadmap bear directly on it. Do you have 20 minutes next week?`)
          : `Hello ${first},\n\n${biz}It's been a while since we last spoke properly, and I owe you an update on where the platform is going.\n\nToday ${account.name} runs ${usage ?? "the Vendasta platform"} with us${move ? `, and ${move.text} over the last 60 days` : ""}. Before I plan anything for the second half, I want your read on where ${account.name} is headed.\n\nDo you have 20 minutes next week? Send a time and I'll build around it.\n\nTanmay`,
      },
      {
        day: 5,
        channel: "email",
        action: "Roadmap Substance",
        subject: `What's landing on the roadmap this quarter`,
        body: `Hello ${first},\n\nFollowing up with specifics. ${ROADMAP_REF} set the direction; the near-term piece is that ${ROADMAP_Q3}. For ${vc.smbs}: ${vc.aiAngle}.\n\n${hasAI
          ? `You already run ${aiList} — these releases extend what your team has deployed, they don't replace it.`
          : `${account.name} has no AI products live today, so there's nothing to migrate. We'd be starting clean.`}\n\nIf a call is easier than email, 15 minutes covers it.\n\nTanmay`,
      },
      {
        day: 11,
        channel: "email",
        action: "Direct Ask",
        subject: `Re: ${account.name} + Vendasta — where we stand`,
        body: `Hello ${first},\n\nI know the calendar is the constraint, so: send me any 20-minute window in the next two weeks and I'll make it work.\n\n${account.name} is one of the accounts I'm building my second-half plan around. I'd rather build it with your input than without.\n\nTanmay`,
      },
      {
        day: 16,
        channel: "call",
        action: "Discovery Call",
        callPrep,
        note: "If no response by Day 14, send a calendar invite for a specific slot rather than asking for availability.",
      },
      {
        day: 23,
        channel: "email",
        action: "Graceful Offramp",
        subject: `Re: ${account.name} + Vendasta — where we stand`,
        body: `Hello ${first},\n\nI'll stop filling your inbox for now. If priorities have shifted on your side, that's useful for me to know too — a one-line reply covers it.\n\nI'll check back later in the quarter.\n\nTanmay`,
      },
    ];
  }

  if (situation === "declining" || situation === "atRisk") {
    return [
      {
        day: 1,
        channel: "email",
        action: "Strategic Review Request",
        subject: topAlert ? `${account.name} — want to compare notes` : `${account.name} — the last 60 days`,
        body: topAlert
          ? intelFirstEmail(first, account, topAlert, `I want to make sure we build the right plan for ${account.name} with that context in mind${move?.direction === "down" ? ` — especially since ${move.text} on our side` : ""}. A 20-minute call covers it. Are you free this week or next?`)
          : `Hello ${first},\n\n${biz}I'm writing about the numbers: ${move?.text ?? "billings have stepped down over the last 60 days"}. That may be a deliberate change on your side — a product decision, a budget cycle — or something we should fix together. I'd rather ask than assume.\n\nYou run ${usage ?? "the Vendasta platform"} with us, so there's room to work either way. Do you have 20 minutes this week?\n\nTanmay`,
      },
      {
        day: 4,
        channel: "email",
        action: "Adoption Levers",
        subject: `Re: ${account.name} — the last 60 days`,
        body: `Hello ${first},\n\nAdding substance to my last note. ${ROADMAP_REF} set the direction; the near-term piece is that ${ROADMAP_Q3}. For ${vc.smbs}: ${vc.aiAngle}.\n\nIf the step-down reflects soft adoption rather than a decision, these lift usage of what you already pay for. That's the first lever I'd pull.\n\nTanmay`,
      },
      {
        day: 8,
        channel: "call",
        action: "Strategy Call",
        callPrep,
      },
      {
        day: 13,
        channel: "email",
        action: "Decision Point",
        subject: `Re: ${account.name} — the last 60 days`,
        body: `Hello ${first},\n\nWhere things stand: ${move?.text ?? "billings are down over the last 60 days"}. I want a clear plan against that — recover the volume, adjust the product mix, or rightsize the commitment if that's the honest answer.\n\nA 20-minute call this week settles it. What works for you?\n\nTanmay`,
        note: "This is the first touch where you name the billing numbers directly. By now you've earned the right to be direct.",
      },
      {
        day: 19,
        channel: "linkedin",
        action: "Secondary Channel",
        body: `Hi ${first} — I've sent a few notes on ${account.name}'s recent direction and haven't heard back. Trying here in case email is buried. Happy to work around your schedule if now isn't the right time.`,
      },
    ];
  }

  if (situation === "champion") {
    return [
      {
        day: 1,
        channel: "email",
        action: "QBR Invite",
        subject: topAlert ? `${account.name} — building on the momentum` : `${account.name} — quarterly review and what's next`,
        body: topAlert
          ? intelFirstEmail(first, account, topAlert, `With that as backdrop: ${move?.direction === "up" ? `${move.text}, and` : ""} I want to make sure we build on ${account.name}'s trajectory rather than just maintain it. Worth a dedicated 30 minutes? I'll bring specifics on the second-half opportunity.`)
          : `Hello ${first},\n\n${biz}The numbers speak for themselves: ${move?.direction === "up" ? move.text : `${account.name} runs ${usage ?? "a substantial deployment"} with us and it's holding strong`}. That's exactly when I want dedicated time — to decide what we build on top of it, not to admire it.\n\nWorth 30 minutes for a proper quarterly review? I'll bring specifics, including where this quarter's launches (${ROADMAP_Q3.replace(" both launch this quarter", "")}) fit your ${vc.smbs}.\n\nTanmay`,
      },
      {
        day: 5,
        channel: "email",
        action: "Expansion Angle",
        subject: `Ahead of our call — the expansion I'd look at`,
        body: `Hello ${first},\n\nAhead of our call, the one idea I want your read on: ${vc.aiAngle}.\n\nYou run ${usage ?? "a solid stack"} today. The expansion I have in mind builds on that footprint rather than opening a new front. I'll send a short brief before we connect.\n\nTanmay`,
      },
      {
        day: 10,
        channel: "call",
        action: "QBR",
        callPrep,
        note: "30-minute QBR. Come with a pre-built one-pager: current state, second-half opportunity, and two specific expansion proposals.",
      },
      {
        day: 15,
        channel: "email",
        action: "Proposal Follow-up",
        subject: `Following up — ${account.name} next steps`,
        body: `Hello ${first},\n\nGood conversation. The expansion modeling and the timeline we discussed will be in your inbox by end of week.\n\nTanmay`,
        note: "Fill in the specifics from the QBR before sending.",
      },
      {
        day: 26,
        channel: "gchat",
        action: "Pulse Check",
        body: `Hey ${first}, checking in on the items from our last call — any movement on your end?`,
      },
    ];
  }

  // stable / default
  return [
    {
      day: 1,
      channel: "email",
      action: "Strategic Outreach",
      subject: topAlert ? `${account.name} — saw the news, want to connect` : `${account.name} — second-half planning`,
      body: topAlert
        ? intelFirstEmail(first, account, topAlert, `That's part of what I wanted to connect on. You run ${usage ?? "the Vendasta platform"} with us today, and I want to check that it's still the right stack for where ${account.name} is going. Do you have 20 minutes this week or next?`)
        : `Hello ${first},\n\n${biz}You run ${usage ?? "the Vendasta platform"} with us${move ? `, and ${move.text}` : ", and billings have held steady"}. Heading into the second half, I want to check that this is still the right stack for where ${account.name} is going — ${ROADMAP_REF} set the direction, and ${ROADMAP_Q3}.\n\nDo you have 20 minutes this week or next?\n\nTanmay`,
    },
    {
      day: 5,
      channel: "email",
      action: "Product Fit Detail",
      subject: `Re: ${account.name} — second-half planning`,
      body: `Hello ${first},\n\nThe specific item I'd walk through: ${vc.aiAngle}.\n\n${hasAI
          ? `You already run ${aiList}. This quarter's additions extend that footprint, and I can share adoption numbers from other ${account.vertical} partners so you can judge the fit yourself.`
          : `${account.name} has no AI products live yet. Starting clean is easier — no migration, and your ${vc.smbs} see the impact from day one.`}\n\nDo you have 20 minutes this week or next?\n\nTanmay`,
    },
    {
      day: 9,
      channel: "call",
      action: "Strategy Call",
      callPrep,
    },
    {
      day: 15,
      channel: "email",
      action: "Follow-up",
      subject: `Following up — ${account.name}`,
      body: `Hello ${first},\n\nFollowing up. The agenda is specific to ${account.name}: your current stack, the movement in your billings, and two roadmap items that affect how your ${vc.smbs} get found.\n\nIf this week doesn't work, tell me what does.\n\nTanmay`,
    },
    {
      day: 22,
      channel: "email",
      action: "Close the Loop",
      subject: `Re: ${account.name} + 2026 AI roadmap`,
      body: `Hello ${first},\n\nLast note on this for now. If the timing is wrong this quarter, say so and I'll come back with the same agenda when it isn't.\n\nIf there's a quicker question I can answer by email in the meantime, send it over.\n\nTanmay`,
    },
  ];
}

// ─── Component ─────────────────────────────────────────────────────────────────

function formatRelativeDate(date: string): string {
  const days = daysSince(date);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function OutreachPlanner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { accounts, orgAlerts } = useAM();
  const accountId = searchParams.get("account");
  const intelId = searchParams.get("intel");
  const situationParam = searchParams.get("situation");
  const account = accounts.find(a => a.id === accountId) || accounts[0];

  const accountAlerts = orgAlerts
    .filter(a => a.accountId === account.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const topAlert: OrgAlert | null =
    (intelId ? accountAlerts.find(a => a.id === intelId) ?? null : null) ||
    accountAlerts.find(a => (a.urgency === "high" || a.urgency === "medium") && daysSince(a.date) <= 45) ||
    null;

  const ctx = getCommissionContext(account);
  const situation = getSituation(account, ctx, situationParam);
  const sequence = buildSequence(account, ctx, topAlert, situation);
  const situationMeta = SITUATION_META[situation];

  const [expandedStep, setExpandedStep] = useState<number | null>(0);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const channelIcon = (channel: OutreachStep["channel"]) => {
    if (channel === "email") return <Mail className="w-4 h-4" />;
    if (channel === "gchat") return <Send className="w-4 h-4" />;
    if (channel === "call") return <Phone className="w-4 h-4" />;
    return <ExternalLink className="w-4 h-4" />;
  };

  const channelColor = (channel: OutreachStep["channel"]) => {
    if (channel === "email") return "bg-v-blue/10 text-v-blue";
    if (channel === "gchat") return "bg-v-green/10 text-v-green";
    if (channel === "call") return "bg-v-red/10 text-v-red";
    return "bg-v-purple/10 text-v-purple";
  };

  const channelLabel = (channel: OutreachStep["channel"]) => {
    if (channel === "gchat") return "GChat";
    if (channel === "linkedin") return "LinkedIn";
    return channel.charAt(0).toUpperCase() + channel.slice(1);
  };

  return (
    <div className="animate-fade-in">
      <Header
        title="Outreach Planner"
        subtitle={`Multi-touch sequence for ${account.name}`}
      />

      {/* Account selector */}
      <div className="px-6 pt-3 pb-0">
        <select
          value={account.id}
          onChange={e => setSearchParams({ account: e.target.value })}
          className="text-xs border border-border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left panel ── */}
        <div className="lg:col-span-1 space-y-5">

          {/* Account card */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-lg font-semibold text-muted-foreground">
                  {account.name[0]}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{account.name}</h2>
                  <p className="text-xs text-muted-foreground">{account.contactName} · {account.contactTitle}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-2 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Billings ({ctx.latestLabel})</p>
                  <p className="text-sm font-bold text-foreground">{formatCurrency(ctx.latestMRR)}</p>
                </div>
                <div className="p-2 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Commissionable</p>
                  <p className="text-sm font-bold text-v-teal">{formatCurrency(ctx.commissionable)}</p>
                </div>
                <div className="p-2 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    60-Day Δ{ctx.recent ? ` (${ctx.recent.fromLabel}→${ctx.recent.toLabel})` : ""}
                  </p>
                  <p className={cn("text-sm font-bold flex items-center gap-1", (ctx.recent?.delta ?? 0) < 0 ? "text-v-red" : "text-v-green")}>
                    {(ctx.recent?.delta ?? 0) < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                    {(ctx.recent?.delta ?? 0) < 0 ? "−" : "+"}{formatCurrency(Math.abs(ctx.recent?.delta ?? 0))}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Sequence</p>
                  <Badge variant={situationMeta.variant} className="mt-0.5 text-[10px]">{situationMeta.label}</Badge>
                </div>
              </div>

              {account.products.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-foreground">Active AI Products</p>
                  <div className="flex flex-wrap gap-1">
                    {account.products.map(p => (
                      <Badge key={p} variant="outline" className="text-[10px] px-1.5 py-0">{p}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {account.notes && (
                <div className="pt-1 border-t border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Notes</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{account.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Partner Intelligence */}
          {accountAlerts.length > 0 && (
            <Card className="border-v-amber/30 bg-v-amber/5">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-v-amber" />
                    <h3 className="text-sm font-semibold text-foreground">Partner Intelligence</h3>
                  </div>
                  {accountAlerts.length > 1 && (
                    <Badge variant="outline" className="text-[10px]">{accountAlerts.length} signals</Badge>
                  )}
                </div>
                {accountAlerts.slice(0, 2).map(alert => (
                  <div
                    key={alert.id}
                    className={cn(
                      "p-3 rounded-lg border space-y-1.5",
                      alert.id === intelId || alert.id === topAlert?.id
                        ? "bg-v-amber/10 border-v-amber/40"
                        : "bg-secondary/50 border-border"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={alert.urgency === "high" ? "danger" : alert.urgency === "medium" ? "warning" : "outline"}
                        className="text-[10px] capitalize"
                      >
                        {alert.type.replace("-", " ")}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{formatRelativeDate(alert.date)}</span>
                    </div>
                    <p className="text-xs font-semibold text-foreground leading-snug">{alert.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{alert.summary}</p>
                    {alert.actionSuggestion && (
                      <p className="text-[10px] text-v-amber italic border-l-2 border-v-amber/40 pl-2 leading-relaxed">
                        {alert.actionSuggestion}
                      </p>
                    )}
                  </div>
                ))}
                {topAlert && (
                  <p className="text-[10px] text-muted-foreground">
                    ↑ Top signal woven into Day 1 email automatically
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Commission lens */}
          <Card className="border-v-teal/20 bg-v-teal/5">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-v-teal" />
                <h3 className="text-sm font-semibold text-foreground">Commission Lens</h3>
              </div>
              <ul className="space-y-2 text-xs text-foreground leading-relaxed">
                <li>
                  Effective inclusion rate is {Math.round(ctx.effRate * 100)}% — every $1,000 retained or added here is {formatCurrency(Math.round(ctx.effRate * 1000))} commissionable toward WAMGR.
                </li>
                <li>
                  {ctx.qoqDelta < 0
                    ? `Recovering the ${formatCurrency(Math.abs(ctx.qoqDelta))}/mo QoQ decline restores ${formatCurrency(Math.round(Math.abs(ctx.qoqDelta) * ctx.effRate))}/mo commissionable.`
                    : ctx.qoqDelta === 0
                    ? "Billings are flat QoQ. AI products carry a 95% inclusion rate — the highest-value expansion path."
                    : `Billings are up ${formatCurrency(ctx.qoqDelta)} QoQ. AI products carry a 95% inclusion rate — the highest-value expansion path.`}
                </li>
                {ctx.topProduct && (
                  <li>
                    Largest commissionable line: {ctx.topProduct.name} ({formatCurrency(ctx.topProduct.commissionable)}/mo).
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* ── Sequence timeline ── */}
        <div className="lg:col-span-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Recommended Sequence
              </h2>
              <Badge variant="outline">
                {sequence.length} touches · {sequence[sequence.length - 1].day} days
              </Badge>
            </div>

            <div className="space-y-3 relative before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-px before:bg-border">
              {sequence.map((step, idx) => {
                const isExpanded = expandedStep === idx;
                return (
                  <Card key={idx} className="relative ml-10 overflow-hidden">
                    {/* Day bubble */}
                    <div className="absolute left-[-41px] top-4 w-6 h-6 rounded-full bg-background border-2 border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground z-10">
                      {step.day}
                    </div>

                    {/* Header row */}
                    <button
                      onClick={() => setExpandedStep(isExpanded ? null : idx)}
                      className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", channelColor(step.channel))}>
                          {channelIcon(step.channel)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{step.action}</p>
                          <p className="text-xs text-muted-foreground">{channelLabel(step.channel)} · Day {step.day}</p>
                        </div>
                      </div>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                    </button>

                    {/* Expanded: call prep */}
                    {isExpanded && step.callPrep && (
                      <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200 space-y-3">
                        {step.note && (
                          <p className="text-xs text-v-amber italic border-l-2 border-v-amber/40 pl-3">{step.note}</p>
                        )}
                        <div className="p-3 rounded-lg bg-secondary/50 border border-border space-y-3">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight mb-1.5">Open with</p>
                            <p className="text-sm text-foreground italic leading-relaxed">{step.callPrep.opening}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight mb-1.5">Questions to ask</p>
                            <ul className="space-y-1.5">
                              {step.callPrep.questions.map((q, i) => (
                                <li key={i} className="flex gap-2 text-sm text-foreground">
                                  <span className="text-muted-foreground shrink-0 font-medium">{i + 1}.</span>
                                  <span className="italic leading-relaxed">{q}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight mb-1.5">Product angles</p>
                            <ul className="space-y-1.5">
                              {step.callPrep.angles.map((a, i) => (
                                <li key={i} className="flex gap-2 text-sm text-foreground">
                                  <span className="text-v-blue shrink-0">→</span>
                                  <span className="leading-relaxed">{a}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight mb-1.5">Close with</p>
                            <p className="text-sm text-foreground italic leading-relaxed">{step.callPrep.close}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(
                            `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${account.name} — strategy call`)}&add=${encodeURIComponent(account.contactEmail)}`
                          )}
                        >
                          <Calendar className="w-3.5 h-3.5" /> Schedule Call
                        </Button>
                      </div>
                    )}

                    {/* Expanded: email / gchat / linkedin body */}
                    {isExpanded && step.body && (
                      <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                        {step.note && (
                          <p className="text-xs text-v-amber italic border-l-2 border-v-amber/40 pl-3 mb-3">{step.note}</p>
                        )}
                        <div className="p-3 rounded-lg bg-secondary/50 border border-border space-y-3">
                          {step.subject && (
                            <div className="border-b border-border pb-2">
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Subject</p>
                              <p className="text-sm text-foreground mt-0.5">{step.subject}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight mb-1">
                              {step.channel === "gchat" ? "Message" : step.channel === "linkedin" ? "LinkedIn message" : "Body"}
                            </p>
                            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{step.body}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Button size="sm" variant="outline" onClick={() => copyToClipboard(step.body!, idx)}>
                            {copiedIdx === idx
                              ? <><CheckCircle2 className="w-3.5 h-3.5 text-v-green" /> Copied</>
                              : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                          </Button>
                          {step.channel === "email" && (
                            <Button size="sm" onClick={() => window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(account.contactEmail)}&su=${encodeURIComponent(step.subject || "")}&body=${encodeURIComponent(step.body || "")}`)}>
                              <Mail className="w-3.5 h-3.5" /> Open in Gmail
                            </Button>
                          )}
                          {step.channel === "gchat" && (
                            <Button size="sm" variant="outline" onClick={() => window.open("https://chat.google.com/")}>
                              <Send className="w-3.5 h-3.5" /> Open GChat
                            </Button>
                          )}
                          {step.channel === "linkedin" && (
                            <Button size="sm" variant="outline" onClick={() => window.open(`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${account.contactName} ${account.name}`)}`)}>
                              <ExternalLink className="w-3.5 h-3.5" /> Open LinkedIn
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
