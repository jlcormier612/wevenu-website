/**
 * Pricing page — editorial hospitality catalog, not SaaS comparison.
 * Cards show Regular Price prominently, with Founding and Welcome Back rates beneath.
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
      name: "Gather",
      capacity: "Up to 25 annual celebrations",
      price: "$149",
      period: "/month",
      priceCaption: "Regular Price",
      foundingPrice: "$119/month",
      foundingNote: "Available for the first 100 venues",
      welcomeBackPrice: "$119/month",
      welcomeBackNote: "For eligible former Weven customers through December 31, 2026",
      cta: "Get Started",
      kind: "subscription" as const,
    },
    {
      id: "growing" as const,
      name: "Celebrate",
      capacity: "Up to 75 annual celebrations",
      price: "$249",
      period: "/month",
      priceCaption: "Regular Price",
      foundingPrice: "$199/month",
      foundingNote: "Available for the first 100 venues",
      welcomeBackPrice: "$199/month",
      welcomeBackNote: "For eligible former Weven customers through December 31, 2026",
      cta: "Get Started",
      kind: "subscription" as const,
    },
    {
      id: "professional" as const,
      name: "Flourish",
      capacity: "Up to 200 annual celebrations",
      price: "$349",
      period: "/month",
      priceCaption: "Regular Price",
      foundingPrice: "$299/month",
      foundingNote: "Available for the first 100 venues",
      welcomeBackPrice: "$299/month",
      welcomeBackNote: "For eligible former Weven customers through December 31, 2026",
      cta: "Get Started",
      kind: "subscription" as const,
    },
    {
      id: "enterprise" as const,
      name: "Custom",
      capacity: "Multi-venue",
      price: null,
      period: null,
      priceLabel: "Let's build something together.",
      priceCaption: null,
      foundingPrice: null,
      foundingNote: null,
      welcomeBackPrice: null,
      welcomeBackNote: null,
      cta: "Let's Talk.",
      kind: "contact" as const,
    },
  ],
  beneathPlans: {
    lines: [
      "Founding Pricing is available for the first 100 venues and is locked in for as long as your subscription remains active.",
      "Welcome Back Pricing is available to eligible former Weven customers who join by December 31, 2026 and is also locked in while subscribed.",
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
    intro: [
      "The first 100 venues to join Hello to Cheers will receive Founding Pricing that's locked in for as long as their subscription remains active.",
      "Founding Membership isn't simply an introductory discount.",
      "It's our way of thanking the venues that choose to help us build something exceptional from the very beginning.",
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
    headline: "Welcome Back",
    lines: [
      "If you were part of the Weven community, we'd love to welcome you back.",
      "As a thank you for being part of that journey, eligible former Weven customers may join Hello to Cheers using Welcome Back Pricing through December 31, 2026.",
      "Once you join, your Welcome Back Pricing is locked in for as long as your subscription remains active.",
      "Some relationships deserve a second chapter.",
      "This is simply our way of saying thank you—and welcome home.",
    ],
  },
  closing: {
    headline: "Ready to welcome your next celebration?",
    lines: [
      "Everything you need.",
      "Nothing you don't.",
      "Founding Pricing is available for the first 100 venues.",
    ],
    cta: "Schedule a Walkthrough",
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
          "Step-by-step launch guide",
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
} as const;
