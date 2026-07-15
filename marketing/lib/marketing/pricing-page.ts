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
      "Every Wevenu subscription includes every feature. The only thing that changes is the number of celebrations you host each year.",
      "No contracts. No hidden fees. Cancel anytime.",
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
      priceLabel: "Contact Sales",
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
      "Luv AI Assistant",
      "Unlimited Team Members",
      "Product Updates",
    ],
    note: "No feature gates. No upgrades required to unlock essential tools.",
  },
  philosophy: {
    eyebrow: "Our Pricing Philosophy",
    lines: [
      "We don't believe essential features should be hidden behind higher-priced plans.",
      "Every venue deserves the complete Wevenu experience.",
      "The only difference between plans is the number of celebrations you host each year.",
      "As your business grows, your plan grows with you.",
    ],
  },
} as const;
