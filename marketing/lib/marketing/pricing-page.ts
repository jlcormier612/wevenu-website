/**
 * Pricing page — editorial hospitality catalog, not SaaS comparison.
 * Display mode (Founder vs Welcome Back vs regular) is controlled by enrollment config.
 */

export type SubscriptionPlanId = "starter" | "growing" | "professional";

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
    {
      id: "enterprise" as const,
      name: "Custom",
      capacity: "Multi-venue/More Celebrations",
      price: null,
      period: null,
      priceLabel: "Let's build something together.",
      foundingPrice: null,
      welcomeBackPrice: null,
      cta: "Let's Talk.",
      kind: "contact" as const,
    },
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
      "Former Weven customers receive Founding Member pricing during our launch period.",
      "At checkout, simply note that your venue was part of the Weven family.",
    ],
  },
  closing: {
    headline: "Ready to welcome your next celebration?",
    lines: ["Everything you need.", "Nothing you don't."],
    cta: "Schedule a Walkthrough",
  },
  gettingStarted: {
    headline: "How would you like to get started?",
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
          "Resource library",
          "Progress tracking",
          "Step-by-step launch guide",
        ],
        body: [] as string[],
        footer: ["Most venues can complete setup in just a few hours."],
      },
      {
        eyebrow: "Optional",
        title: "White Glove Setup",
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
