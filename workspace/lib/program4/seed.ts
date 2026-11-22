import type {
  CommissionEventType,
  CommissionLedgerEntry,
  CommissionPlan,
  TeamMemberProfile,
} from "./types";

export const PLAN_IDS = {
  salesStandard: "plan_sales_standard",
  csRenewal: "plan_cs_renewal",
  implementation: "plan_implementation",
  leadership: "plan_leadership",
  none: "plan_none",
} as const;

export const SEED_COMMISSION_PLANS: CommissionPlan[] = [
  {
    id: PLAN_IDS.salesStandard,
    name: "Sales Standard",
    description: "Walkthrough booking bonus plus subscription and White Glove rates.",
    active: true,
    rates: {
      walkthrough_booked: { mode: "flat", cents: 5000 },
      subscription_sold: { mode: "percent", bps: 1000 },
      white_glove_sold: { mode: "flat", cents: 20000 },
      renewal: { mode: "percent", bps: 500 },
      referral: { mode: "flat", cents: 15000 },
      expansion: { mode: "percent", bps: 800 },
    },
  },
  {
    id: PLAN_IDS.csRenewal,
    name: "CS Retention",
    description: "Renewal, referral, and expansion bonuses for Customer Success.",
    active: true,
    rates: {
      renewal: { mode: "flat", cents: 7500 },
      referral: { mode: "flat", cents: 10000 },
      expansion: { mode: "flat", cents: 10000 },
      white_glove_sold: { mode: "flat", cents: 5000 },
    },
  },
  {
    id: PLAN_IDS.implementation,
    name: "Implementation Assist",
    description: "Small bonus when White Glove deals close into onboarding.",
    active: true,
    rates: {
      white_glove_sold: { mode: "flat", cents: 7500 },
      subscription_sold: { mode: "flat", cents: 2500 },
    },
  },
  {
    id: PLAN_IDS.leadership,
    name: "Leadership Override",
    description: "Owner / admin override — typically $0; used for attribution only.",
    active: true,
    rates: {},
  },
  {
    id: PLAN_IDS.none,
    name: "No Commission",
    description: "Support, marketing, and viewer roles without variable pay.",
    active: true,
    rates: {},
  },
];

/**
 * Batch 1 — operational bootstrap only.
 * Never seed fictional staff or sample commission ledger rows.
 * Owner display profile aligns with the real Supabase Auth / htc_internal_staff Owner.
 */
export const BOOTSTRAP_OWNER_PROFILE: TeamMemberProfile = {
  id: "tm_jen",
  name: "Jennifer Marshall",
  email: "jennifer@hellotocheers.com",
  initials: "JM",
  role: "owner",
  title: "Founder & Owner",
  department: "leadership",
  commissionPlanId: PLAN_IDS.leadership,
  goals: [],
  availability: "available",
  territory: null,
  active: true,
  joinedAt: "2024-01-15T12:00:00.000Z",
};

/** Operational team bootstrap written on first init / migration. */
export const SEED_TEAM: TeamMemberProfile[] = [BOOTSTRAP_OWNER_PROFILE];

/**
 * Former fictional demo roster IDs (Batch 1 removal).
 * Used only to scrub legacy JSONL — never re-seeded.
 */
export const LEGACY_FICTIONAL_TEAM_MEMBER_IDS = [
  "tm_maya",
  "tm_eli",
  "tm_sara",
  "tm_noah",
  "tm_ava",
  "tm_leo",
  "tm_admin",
] as const;

/** Empty — sample Jul-2026 ledger removed; real entries come from commission events. */
export const SEED_COMMISSION_LEDGER: CommissionLedgerEntry[] = [];

/** Marker schema for Program4 bootstrap (bump to force one-time scrub on deploy). */
export const PROGRAM4_BOOTSTRAP_VERSION = 2;

export const COMMISSION_EVENT_LABELS: Record<CommissionEventType, string> = {
  walkthrough_booked: "Walkthrough booked",
  subscription_sold: "Subscription sold",
  white_glove_sold: "White Glove sold",
  renewal: "Renewal",
  referral: "Referral",
  expansion: "Expansion",
};

export const DEFAULT_ACTOR_ID = "tm_jen";
