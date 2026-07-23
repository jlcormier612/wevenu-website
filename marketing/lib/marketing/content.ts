/**
 * Placeholder marketing content.
 * Swap these strings when messaging is finalized — layout stays put.
 */

export const PLACEHOLDER = {
  hero: {
    headline: "Headline placeholder — calm confidence for venue owners",
    sentence:
      "One short supporting sentence will live here once messaging is locked.",
    secondaryCta: "Explore the product",
  },
  trusted: {
    eyebrow: "Trusted by Modern Venues",
    body: "Logo and testimonial placeholders will appear here.",
  },
  connected: {
    headline: "The Entire Venue, Connected",
    intro:
      "A concise introduction to how Hello to Cheers brings sales, planning, communication, operations, financials, and guest experience into one calm workspace.",
  },
  pillars: [
    {
      title: "Sales",
      body: "Placeholder — inquiries, pipeline, and booking momentum.",
    },
    {
      title: "Planning",
      body: "Placeholder — collaborative planning from booking to event day.",
    },
    {
      title: "Communication",
      body: "Placeholder — inbox, templates, and thoughtful follow-through.",
    },
    {
      title: "Operations",
      body: "Placeholder — calendar, timelines, floor plans, and day-of clarity.",
    },
    {
      title: "Financials",
      body: "Placeholder — packages, contracts, invoices, and payment schedules.",
    },
    {
      title: "Guest Experience",
      body: "Placeholder — portals and wedding websites that feel like your venue.",
    },
  ],
  howItWorks: {
    headline: "How Hello to Cheers Works",
    steps: [
      { title: "Capture the inquiry", body: "Step description placeholder." },
      { title: "Guide the booking", body: "Step description placeholder." },
      { title: "Plan collaboratively", body: "Step description placeholder." },
      { title: "Deliver flawlessly", body: "Step description placeholder." },
      { title: "Delight guests", body: "Step description placeholder." },
    ],
  },
  luv: {
    headline: "Meet Luv.",
    body: "Your venue's built-in quiet assistance — included with the platform.",
  },
  dual: {
    couples: {
      title: "Beautiful for Couples.",
      body: "Placeholder for couple portal and wedding website experience.",
    },
    venues: {
      title: "Powerful for Venues.",
      body: "Placeholder for dashboard, calendar, and planning workspace.",
    },
  },
  pricing: {
    headline: "Pricing",
    intro: "Simple plans designed around how venues actually work. Pricing shared on a walkthrough.",
    tiers: [
      {
        name: "Professional",
        audience: "Perfect for growing venues",
        description:
          "Everything needed to manage bookings, planning, communication, and operations.",
      },
      {
        name: "Enterprise",
        audience: "Multi-location venues and hospitality groups",
        description: "Custom implementation and onboarding.",
      },
    ],
  },
  about: {
    headline: "About Hello to Cheers",
    body: "Story and founding narrative placeholder — peace of mind for independent venues.",
  },
  product: {
    headline: "Product",
    intro: "An overview of the Hello to Cheers operating system for wedding and event venues.",
  },
  walkthrough: {
    headline: "Schedule a Walkthrough",
    body: "A personalized conversation about your venue — no pressure, just an inside look\nat how your process would work on our platform (or not).",
  },
  contact: {
    headline: "Contact",
    body: "Reach the Hello to Cheers team. We respond with care and clarity.",
  },
} as const;

/** Editorial venue photography placeholders (replace with licensed assets later). */
export const MARKETING_MEDIA = {
  heroVenue:
    "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1600&q=80",
  estate:
    "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1400&q=80",
  garden:
    "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1400&q=80",
  tablescape:
    "https://images.unsplash.com/photo-1478144592103-25e218a04891?auto=format&fit=crop&w=1400&q=80",
  vineyard:
    "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=1400&q=80",
  architecture:
    "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1400&q=80",
  dashboard: "/marketing/homepage-dashboard-overview.png",
  /** Header/footer lockup — Hello to Cheers + WITH LUV. */
  logo: "/brand/hello-to-cheers-logo-primary-transparent.png",
  logoPng: "/brand/hello-to-cheers-logo-primary-transparent.png",
  logoLockup: "/brand/hello-to-cheers-logo-primary-transparent.png",
  /** Body-copy wordmark only */
  wordmark: "/brand/hello-to-cheers-wordmark-transparent.png",
  mark: "/brand/hello-to-cheers-logo-primary-transparent.png",
} as const;
