/**
 * Pricing page — editorial hospitality catalog, not SaaS comparison.
 */

export type SubscriptionPlanId = "starter" | "growing" | "professional";

export const PRICING_PAGE = {
  hero: {
    headline: "One platform. Every feature. Simple monthly pricing.",
    lines: [
      "Hospitality should feel simple.",
      "Your software should too.",
      "Every Hello to Cheers subscription includes every feature. The only thing that changes is the number of celebrations you host each year.",
      "No contracts. No hidden fees. Optional services are always clearly listed. Cancel anytime.",
    ],
  },
  plans: [
    {
      id: "starter" as const,
      name: "Starter",
      capacity: "Up to 25 annual events",
      price: "$149",
      period: "/month",
      cta: "Get Started",
      kind: "subscription" as const,
    },
    {
      id: "growing" as const,
      name: "Growing",
      capacity: "Up to 75 annual events",
      price: "$249",
      period: "/month",
      cta: "Get Started",
      kind: "subscription" as const,
    },
    {
      id: "professional" as const,
      name: "Professional",
      capacity: "Up to 200 annual events",
      price: "$349",
      period: "/month",
      cta: "Get Started",
      kind: "subscription" as const,
    },
    {
      id: "enterprise" as const,
      name: "Enterprise",
      capacity: "Multiple venues or higher volume",
      price: null,
      period: null,
      priceLabel: "Contact the team",
      cta: "Let's Talk.",
      kind: "contact" as const,
    },
  ],
  included: {
    headline: "Every plan includes:",
    features: [
      "CRM & Lead Management",
      "Event Management",
      "Client Portal",
      "Vendor Portal",
      "Planning Playbooks",
      "Timeline Builder",
      "Payments",
      "Contracts",
      "Floor Plans",
      "Seating",
      "Messaging",
      "Automations",
      "Reporting",
      "Luv - Venue Assistant",
      "Unlimited Team Members",
      "Product Updates",
    ],
    note: "No feature gates. No upgrades required to unlock essential tools.",
  },
  gettingStarted: {
    headline: "Choose Your Start",
    intro: [
      "Every Hello to Cheers subscription includes free self-guided setup designed to get your venue live at your own pace.",
      "Choose the onboarding experience that's right for you.",
    ],
    cards: [
      {
        eyebrow: "Included",
        title: "Guided Self Setup",
        price: "$0",
        lead: ["Luv and our interactive onboarding walk you through every step."],
        checklist: [
          "Guided setup wizard",
          "Sample data and templates",
          "Video walkthroughs",
          "Progress tracking",
          "Live chat support",
        ],
        body: [] as string[],
        footer: ["Most venues can complete setup in just a few hours."],
      },
      {
        eyebrow: "Optional",
        title: "Prefer to Skip Setup?",
        price: "One-time $499",
        lead: ["We'll do it for you."],
        checklist: [] as string[],
        body: [
          "Our team imports your existing information, configures your account, organizes your templates, and prepares your workspace so you're ready to start welcoming couples.",
          "Simply review everything together with us, make any final adjustments, and begin using Hello to Cheers.",
        ],
        footer: [
          "No ongoing onboarding fees.",
          "No required implementation.",
          "Just a faster start if you'd like one.",
        ],
      },
    ],
  },
  philosophy: {
    eyebrow: "Our Pricing Philosophy",
    lines: [
      "We don't believe essential features should be hidden behind higher-priced plans.",
      "Every venue deserves the complete Hello to Cheers experience.",
      "The only difference between plans is the number of celebrations you host each year.",
      "As your business grows, your plan grows with you.",
    ],
  },
} as const;
