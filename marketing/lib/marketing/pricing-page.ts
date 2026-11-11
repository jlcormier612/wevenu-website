/**
 * Pricing page — V1 catalog only.
 * Plan amounts always derive from shared/pricing catalog helpers.
 * Legacy $149 / fixed Founding amounts are never customer-facing.
 */

import {
  WEVEN_WHITE_GLOVE_AMOUNT_CENTS,
  WHITE_GLOVE_AMOUNT_CENTS,
  formatUsdFromCents,
  getCatalogEntry,
  getPricingLaunchMode,
  getPricingLaunchV1Readiness,
  isPricingWevenV1Ready,
  planDisplayAmounts,
  planWevenDisplayAmounts,
  type PricingLaunchMode,
} from "@shared/pricing";

export type SubscriptionPlanId = "starter" | "growing" | "professional";

export type PricingPlanCard = {
  id: SubscriptionPlanId;
  name: string;
  capacity: string;
  price: string;
  period: string;
  foundingPrice: string;
  welcomeBackPrice: string;
  cta: string;
  kind: "subscription";
};

export type PricingFaqItem = {
  question: string;
  answer: string;
};

function buildV1Plans(wevenReady: boolean): PricingPlanCard[] {
  return (["starter", "growing", "professional"] as const).map((id) => {
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
      welcomeBackPrice: wevenReady ? weven.weven : amounts.founding,
      cta: "Get Started",
      kind: "subscription" as const,
    };
  });
}

const WHITE_GLOVE_PRICE = formatUsdFromCents(WHITE_GLOVE_AMOUNT_CENTS);
const WEVEN_WHITE_GLOVE_PRICE = formatUsdFromCents(WEVEN_WHITE_GLOVE_AMOUNT_CENTS);

export const PRICING_PAGE = {
  hero: {
    headline: "One platform. Every feature. Simple monthly pricing.",
    body: "Everything your venue needs, thoughtfully connected. Every plan includes every feature — your subscription simply reflects the number of celebrations you host.",
  },
  founderPricing: {
    label: "Founding Membership",
    discountNote:
      "Your 10% Founding discount stays with you as your plan evolves.",
  },
  multiVenue: {
    headline: "Managing more than one venue?",
    body: "Each venue has its own subscription. Each additional venue receives 10% off its subscription. Discounts do not stack — your venue receives the single best eligible offer.",
  },
  included: {
    headline: "Everything you need. All included.",
    intro:
      "One complete platform, thoughtfully designed for the way your venue works.",
    supportingLine:
      "Plus unlimited team members, ongoing product updates, and the flexibility to make it all your own.",
    features: [
      "Leads, Tours & Bookings",
      "Proposals & Contracts",
      "Branded Client Portal",
      "Vendor Portal & Collaboration",
      "Planning, Tasks & Timelines",
      "Floor Plans & Seating",
      "Packages, Inventory & Selections",
      "Invoices & Payments",
      "Email, Texting & Automations",
      "Venue Operations & Reporting",
      "Customizable Templates & Workflows",
      "Luv · Your Venue Assistant",
    ],
  },
  foundingMembership: {
    headline: "Founding Membership",
    intro: (spots: number) => [
      `The first ${spots} eligible venues receive 10% off their applicable Hello to Cheers subscription.`,
      "Your Founding discount follows you through tier upgrades and continues to apply to the then-current standard price if pricing increases.",
      "Founding Membership remains available while your subscription stays active. When the subscription ends, Founding eligibility ends.",
    ],
    receivesLabel: "As a Founding Venue, you'll receive:",
    benefits: [
      "10% off your applicable subscription rate",
      "Discount that stays with you as your plan evolves",
      "Early access to new capabilities",
      "Opportunities to preview and share feedback on upcoming features",
      "Direct access to our product team as we continue building together",
    ],
  },
  welcomeBack: {
    eyebrow: "A SPECIAL INVITATION",
    headline: "To our friends from Weven",
    lines: [
      "Some of you may remember us from our Weven days. We had the privilege of working alongside hundreds of wonderful venues, learning from your experiences and building relationships we still treasure.",
      "You welcomed us into your businesses, shared your ideas, celebrated your successes with us, and helped shape our vision.",
      "Hello to Cheers is a completely new platform built from the ground up — informed by years of venue relationships and feedback, and designed for the comprehensive experience we always dreamed of offering.",
      "We'd love the opportunity to work with you again.",
    ],
    thankYou:
      "As a thank-you, former Weven venues receive 20% off their Hello to Cheers subscription, for life.",
    note: [
      "Simply let us know you were a Weven customer when you sign up, and we'll take care of the rest.",
    ],
  },
  gettingStarted: {
    headline: "How would you like to get started?",
    intro: [
      "Setup fees are separate from your monthly subscription. You can adjust your venue configuration anytime.",
    ],
    cards: [
      {
        eyebrow: "Included",
        title: "Guided self-setup",
        price: "$0",
        lead: [
          "Get access right away and walk through a short, guided setup. You can change anything later.",
        ],
      },
      {
        eyebrow: "Optional",
        title: "White Glove Setup",
        price: `One-time ${WHITE_GLOVE_PRICE}`,
        wevenPrice: `Former Weven: one-time ${WEVEN_WHITE_GLOVE_PRICE}`,
        lead: [
          "We'll help build your Hello to Cheers workspace for you. Share your venue information and materials, and we'll take care of the setup work.",
        ],
      },
    ],
  },
  faq: [
    {
      question: "How does event volume determine my subscription?",
      answer:
        "Your plan reflects the number of qualifying booked celebrations in a calendar year. Gather is 0–25, Celebrate is 26–75, and Flourish is 76 or more. New venues with zero qualifying events start on Gather.",
    },
    {
      question: "What happens when our event volume increases?",
      answer:
        "When your qualifying volume requires a higher tier, Hello to Cheers can upgrade your subscription automatically while preserving any eligible percentage discount. You keep every feature at every tier.",
    },
    {
      question: "Can I move to a lower plan?",
      answer:
        "Of course! If your event volume has changed and you think a lower plan might be a better fit, just reach out. We're happy to take a look with you.",
    },
    {
      question: "Are all features included on every plan?",
      answer:
        "Yes. Every Hello to Cheers subscription includes every feature. The only difference is the number of celebrations you host.",
    },
    {
      question: "How does Founding Membership work?",
      answer:
        "The first 100 eligible venues receive 10% off their applicable subscription. The percentage follows tier changes and future standard prices while the subscription remains active. When the subscription ends, Founding eligibility ends.",
    },
    {
      question: "How do former Weven discounts work?",
      answer:
        "Former Weven venues receive 20% off their Hello to Cheers subscription, for life. Just let us know at signup — the discount applies right away and does not stack with Founding or additional-venue offers.",
    },
    {
      question: "How does pricing work for multiple venues?",
      answer:
        "Each venue has its own subscription, and you'll receive 10% off each additional venue. If another offer gives you a better discount, we'll apply that instead. Discounts don't stack.",
    },
    {
      question: "What are the cancellation terms?",
      answer:
        "There is no long-term contract and no cancellation fee. You can cancel anytime in Billing. Access continues through the end of your current paid period; unused days are not refunded.",
    },
  ] as PricingFaqItem[],
  closing: {
    headline: "Ready to welcome your next celebration?",
    lines: [
      "Everything you need. Nothing you don't.",
      "Schedule a 45-minute walkthrough to see Hello to Cheers in action.",
    ],
    cta: "Schedule a Walkthrough",
  },
} as const;

export type PricingPageContent = {
  hero: (typeof PRICING_PAGE)["hero"];
  founderPricing: (typeof PRICING_PAGE)["founderPricing"];
  multiVenue: (typeof PRICING_PAGE)["multiVenue"];
  included: {
    headline: string;
    intro: string;
    supportingLine: string;
    features: readonly string[];
  };
  foundingMembership: (typeof PRICING_PAGE)["foundingMembership"];
  welcomeBack: {
    eyebrow: string;
    headline: string;
    lines: readonly string[];
    thankYou: string;
    note: readonly string[];
  };
  gettingStarted: {
    headline: string;
    intro: readonly string[];
    cards: ReadonlyArray<{
      eyebrow: string;
      title: string;
      price: string;
      wevenPrice?: string;
      lead: readonly string[];
    }>;
  };
  faq: readonly PricingFaqItem[];
  closing: (typeof PRICING_PAGE)["closing"];
  plans: PricingPlanCard[];
};

export type PricingDisplayState = {
  mode: PricingLaunchMode;
  page: PricingPageContent;
  /** False when Checkout cannot fulfill purchases safely. */
  checkoutAvailable: boolean;
  readinessMessage: string;
};

/**
 * Customer-facing Pricing always uses V1 catalog amounts.
 * Checkout is available only when Launch V1 is fully ready.
 */
export function getPricingDisplayState(): PricingDisplayState {
  const readiness = getPricingLaunchV1Readiness();
  const mode = getPricingLaunchMode(readiness);
  const wevenReady = isPricingWevenV1Ready();
  const plans = buildV1Plans(wevenReady);

  return {
    mode: mode === "legacy" ? "v1_misconfigured" : mode,
    page: {
      hero: PRICING_PAGE.hero,
      founderPricing: PRICING_PAGE.founderPricing,
      multiVenue: PRICING_PAGE.multiVenue,
      included: PRICING_PAGE.included,
      foundingMembership: PRICING_PAGE.foundingMembership,
      welcomeBack: {
        eyebrow: PRICING_PAGE.welcomeBack.eyebrow,
        headline: PRICING_PAGE.welcomeBack.headline,
        lines: [...PRICING_PAGE.welcomeBack.lines],
        thankYou: PRICING_PAGE.welcomeBack.thankYou,
        note: [...PRICING_PAGE.welcomeBack.note],
      },
      gettingStarted: {
        headline: PRICING_PAGE.gettingStarted.headline,
        intro: [...PRICING_PAGE.gettingStarted.intro],
        cards: PRICING_PAGE.gettingStarted.cards.map((card) => ({
          ...card,
          lead: [...card.lead],
        })),
      },
      faq: [...PRICING_PAGE.faq],
      closing: PRICING_PAGE.closing,
      plans,
    },
    checkoutAvailable: mode === "v1_ready",
    readinessMessage:
      mode === "legacy"
        ? "Pricing Launch V1 must be enabled before checkout. Catalog amounts shown are V1; purchases are unavailable until configuration is ready."
        : readiness.diagnosticMessage,
  };
}

/** @deprecated Prefer getPricingDisplayState for readiness-aware UI. */
export function getPricingPage(): PricingPageContent {
  return getPricingDisplayState().page;
}
