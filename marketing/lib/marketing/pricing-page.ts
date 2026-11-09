/**
 * Pricing page — editorial hospitality catalog, not SaaS comparison.
 * Display mode (Founder vs Welcome Back vs regular) is controlled by enrollment config.
 *
 * Legacy PRICING_PAGE amounts ($149 / $119 Founding fixed) remain the default so
 * Sandbox keeps advertising the currently serving prices until Launch V1 is ready.
 * When Launch V1 is ready, `getPricingPage()` rewrites plan amounts from the shared catalog.
 */

import {
  getCatalogEntry,
  getPricingLaunchMode,
  getPricingLaunchV1Readiness,
  isPricingWevenV1Ready,
  planDisplayAmounts,
  planWevenDisplayAmounts,
  type PricingLaunchMode,
} from "@shared/pricing";

export type SubscriptionPlanId = "starter" | "growing" | "professional";

const ENTERPRISE_PLAN = {
  id: "enterprise" as const,
  name: "Custom",
  capacity: "Multi-venue/More Celebrations",
  price: null as string | null,
  period: null as string | null,
  priceLabel: "Let's build something together.",
  foundingPrice: null as string | null,
  welcomeBackPrice: null as string | null,
  cta: "Let's Talk.",
  kind: "contact" as const,
};

export const PRICING_PAGE = {
  hero: {
    headline: "One platform. Every feature. Simple monthly pricing.",
    lines: [
      "Hospitality should feel simple.",
      "Your software should too.",
      "Every Hello to Cheers subscription includes every feature. The only thing that changes is the number of celebrations you host each year.",
      "No contracts. No hidden fees. Cancel anytime.",
    ],
  },
  plans: [
    {
      id: "starter" as const,
      name: "Gather",
      capacity: "Up to 25 annual celebrations",
      price: "$149",
      period: "/month",
      foundingPrice: "$119",
      welcomeBackPrice: "$119",
      cta: "Get Started",
      kind: "subscription" as const,
    },
    {
      id: "growing" as const,
      name: "Celebrate",
      capacity: "Up to 75 annual celebrations",
      price: "$249",
      period: "/month",
      foundingPrice: "$199",
      welcomeBackPrice: "$199",
      cta: "Get Started",
      kind: "subscription" as const,
    },
    {
      id: "professional" as const,
      name: "Flourish",
      capacity: "Up to 200 annual celebrations",
      price: "$349",
      period: "/month",
      foundingPrice: "$299",
      welcomeBackPrice: "$299",
      cta: "Get Started",
      kind: "subscription" as const,
    },
    ENTERPRISE_PLAN,
  ],
  founderPricing: {
    label: "Founding Membership",
    lockedNote: "Price locked while subscribed.",
  },
  postFounder: {
    headline: "Former Weven customer?",
    body: "At checkout, let us know if your venue was part of the Weven family. You can subscribe anytime — we'll confirm Welcome Back after you're enrolled.",
    ctaLabel: "Choose a plan",
    ctaHref: "#plans",
  },
  beneathPlans: {
    founder: (spots: number) =>
      `Founding Pricing is available for the first ${spots} venues - plus all former Weven venues - and is locked in for as long as your subscription remains active.`,
    welcomeBack:
      "Welcome Back Pricing is available to eligible former Weven customers who join by December 31, 2026 and is also locked in while subscribed.",
    shared: [
      "Every plan includes every feature.",
      "No feature gates.",
      "No required upgrades.",
    ],
  },
  included: {
    headline: "Every plan includes:",
    features: [
      "CRM & Lead Management",
      "Sales & Bookings",
      "Event Management",
      "Client Portal",
      "Vendor Collaboration",
      "Planning & Timelines",
      "Financials & Payments",
      "Venue Operations",
      "Messaging & Automations",
      "Reporting & Insights",
      "Luv · Venue Assistant",
      "Unlimited Team Members",
      "Product Updates",
    ],
  },
  foundingMembership: {
    headline: "Founding Venue Membership",
    intro: (spots: number) => [
      `The first ${spots} venues to join Hello to Cheers will receive Founding Pricing that's locked in for as long as their subscription remains active.`,
      "Founding Membership isn't simply an introductory discount.",
      "It's our way of thanking the venues that choose to help us build something exceptional from the very beginning.",
      "The first 100 venues—and every former Weven customer—receive our Founding Member pricing.",
    ],
    receivesLabel: "As a Founding Venue, you'll receive:",
    benefits: [
      "Founding Pricing locked while subscribed",
      "Early access to new capabilities",
      "Opportunities to preview and provide feedback on upcoming features",
      "Direct access to our product team as we continue building together",
    ],
  },
  welcomeBack: {
    headline: "To our old friends who believed in us first...",
    lines: [
      "Some time ago, we had the privilege of working alongside hundreds of valued wedding and event venues as their dedicated customer success team on a platform called Weven.",
      "You welcomed us into your businesses, shared your ideas, celebrated your successes with us, and helped shape our vision and future journey.",
      "Hello to Cheers is the next chapter of that story.",
      "We've built a new platform from the ground up, bringing back everything you loved, while creating the truly comprehensive experience we always dreamed of offering.",
      "If you were with us at Weven, we'd be honored to serve you again.",
    ],
    note: [
      "Former Weven venue customers receive 20% off their Hello to Cheers subscription for life.",
      "At checkout, simply confirm that your venue was a Weven customer — we'll apply the discount now and confirm eligibility afterward.",
    ],
  },
  closing: {
    headline: "Ready to welcome your next celebration?",
    lines: ["Everything you need.", "Nothing you don't."],
    cta: "Schedule a Walkthrough",
  },
  gettingStarted: {
    headline: "How would you like to get started?",
    intro: [] as string[],
    cards: [
      {
        eyebrow: "Included",
        title: "I'll set it up myself",
        price: "$0",
        lead: [
          "Get access right away and walk through a short, guided setup. You can change anything later.",
        ],
        checklist: [] as string[],
        body: [] as string[],
        footer: [] as string[],
      },
      {
        eyebrow: "Optional",
        title: "White Glove Setup",
        price: "One-time $499",
        lead: [
          "We'll help build your Hello to Cheers workspace for you. Give us your venue information and materials, and we'll take care of the setup work.",
        ],
        checklist: [] as string[],
        body: [] as string[],
        footer: [] as string[],
      },
    ],
  },
} as const;

export type PricingPlanCard = {
  id: SubscriptionPlanId | "enterprise";
  name: string;
  capacity: string;
  price: string | null;
  period: string | null;
  priceLabel?: string;
  foundingPrice: string | null;
  welcomeBackPrice: string | null;
  cta: string;
  kind: "subscription" | "contact";
};

export type PricingPageContent = Omit<typeof PRICING_PAGE, "plans" | "welcomeBack"> & {
  plans: PricingPlanCard[];
  /**
   * Welcome Back / Former Weven copy may switch between Phase 1 founding
   * messaging and Phase 2 20% lifetime messaging based on readiness.
   */
  welcomeBack: Omit<(typeof PRICING_PAGE)["welcomeBack"], "note"> & {
    note: readonly string[];
  };
};

export type PricingDisplayState = {
  mode: PricingLaunchMode;
  page: PricingPageContent;
  /** False when Launch V1 is flagged on but Checkout cannot fulfill purchases. */
  checkoutAvailable: boolean;
  readinessMessage: string;
};

function buildLaunchPlans(wevenReady: boolean): PricingPlanCard[] {
  const launchPlans: PricingPlanCard[] = (
    ["starter", "growing", "professional"] as const
  ).map((id) => {
    const catalog = getCatalogEntry(id);
    const amounts = planDisplayAmounts(id);
    const weven = planWevenDisplayAmounts(id);
    return {
      id,
      name: catalog.name,
      capacity: catalog.capacityLabel,
      price: amounts.list,
      period: "/month",
      foundingPrice: amounts.founding,
      // Only advertise Weven 20% amounts when Phase 2 Checkout can fulfill them.
      welcomeBackPrice: wevenReady ? weven.weven : amounts.founding,
      cta: "Get Started",
      kind: "subscription",
    };
  });
  return [...launchPlans, { ...ENTERPRISE_PLAN }];
}

/**
 * Marketing + Checkout display source with explicit launch mode.
 *
 * - legacy: current Sandbox amounts ($149 / fixed founding)
 * - v1_ready: catalog V1 amounts; Checkout purchasable
 * - v1_misconfigured: show intended V1 amounts but disable purchase
 *   (never silently advertise legacy $149 while flag is on)
 */
export function getPricingDisplayState(): PricingDisplayState {
  const readiness = getPricingLaunchV1Readiness();
  const mode = getPricingLaunchMode(readiness);

  if (mode === "legacy") {
    return {
      mode,
      page: {
        ...PRICING_PAGE,
        plans: PRICING_PAGE.plans.map((plan) => ({ ...plan })),
      },
      checkoutAvailable: true,
      readinessMessage: readiness.diagnosticMessage,
    };
  }

  const wevenReady = isPricingWevenV1Ready();
  return {
    mode,
    page: {
      ...PRICING_PAGE,
      plans: buildLaunchPlans(wevenReady),
      welcomeBack: {
        ...PRICING_PAGE.welcomeBack,
        note: wevenReady
          ? [...PRICING_PAGE.welcomeBack.note]
          : [
              "Former Weven customers receive Founding Member pricing during our launch period.",
              "At checkout, simply note that your venue was part of the Weven family.",
            ],
      },
    },
    checkoutAvailable: mode === "v1_ready",
    readinessMessage: readiness.diagnosticMessage,
  };
}

/** @deprecated Prefer getPricingDisplayState for readiness-aware UI. */
export function getPricingPage(): PricingPageContent {
  return getPricingDisplayState().page;
}
