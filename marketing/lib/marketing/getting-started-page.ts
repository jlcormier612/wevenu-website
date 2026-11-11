/**
 * Getting Started introductory page — claims verified against Sandbox + pricing.
 * Public copy does not name competitors or imply automatic migration.
 * In-app onboarding may still note a venue's previous platform for setup guidance.
 */

export const GETTING_STARTED_PAGE = {
  meta: {
    title: "Getting Started",
    description:
      "Guided venue setup, supported imports, optional white-glove assistance, and a workspace you can personalize at your own pace.",
  },
  hero: {
    kicker: "Getting Started",
    headline: "Switching shouldn't be the hard part.",
    lede: "You've already put a lot of work into building your business. Hello to Cheers is designed so you can bring what you've built, configure what makes your venue unique, and start running events without starting from scratch.",
  },
  principles: [
    {
      title: "Guided venue setup",
      body: "Setup Hub walks you through configuring spaces, offerings, branding, preferences, and the reusable tools your team uses every day—so foundations are clear before busy season hits.",
    },
    {
      title: "Supported data imports",
      body: "Bring over clients, leads, vendors, packages, inventory, and related business records through Migration Center and spreadsheet import. Imports are reviewed in Hello to Cheers before they become live workspace data.",
    },
    {
      title: "Migration for historical information",
      body: "Migration Center is the cutover path for bringing relevant historical business information into Hello to Cheers. You choose what to bring over, review it, and keep building from there.",
    },
    {
      title: "Optional white-glove setup",
      body: "Prefer help preparing the workspace? White Glove Setup is an optional add-on at checkout. Our team helps prepare your Hello to Cheers workspace around your venue's materials and needs.",
    },
    {
      title: "Set up gradually",
      body: "You don't have to finish everything on day one. Start with what matters most, personalize as you go, and invite clients and vendors when you're ready.",
    },
  ],
  importHonesty: {
    title: "Moving from another platform?",
    paragraphs: [
      "Already using another system to manage your venue? We'll take that into account as we help you get started, so your Hello to Cheers setup reflects the way your venue operates today.",
      "There's no need to start from scratch or change everything at once. We'll help you make a thoughtful transition at a pace that works for you.",
    ],
  },
  whiteGlove: {
    title: "White Glove Setup",
    body: "Available as an optional one-time add-on during pricing checkout. Current published price: +$499 one-time. Included self-setup remains available if you prefer to configure the workspace yourself.",
    cta: { href: "/pricing", label: "Explore Pricing" },
  },
  nextSteps: {
    title: "Ready when you are.",
    body: "Explore pricing, schedule a walkthrough, or continue learning how the platform fits the way your venue already works.",
    primaryCta: { href: "/walkthrough", label: "Schedule a Walkthrough" },
    secondaryCta: { href: "/pricing", label: "Explore Pricing" },
    tertiaryCta: { href: "/product", label: "Explore the Platform" },
  },
} as const;
