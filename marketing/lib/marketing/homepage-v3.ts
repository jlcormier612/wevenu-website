/** Nine-section homepage — approved manuscript + authentic product imagery paths. */

export const HOME_ASSETS = {
  // Hero — approved airy hospitality photography (prep retained for reference)
  heroHospitalityAiry: "/marketing/hero-hospitality-airy.png",
  heroHospitalityPrep: "/marketing/hero-hospitality-prep.jpg",

  // §2 Connected Journey — approved editorial trio
  journeyFirstHello: "/marketing/journey-first-hello.png",
  journeyCollaboration: "/marketing/journey-collaboration.png",
  journeyFinalCheers: "/marketing/journey-final-cheers.png",
  // Preserved Phase 3A.3 product captures (not used in reconstructed hero)
  heroDashboard: "/marketing/homepage-v3/hero-dashboard.png",
  heroPortalMobile: "/marketing/homepage-v3/hero-portal-mobile.png",
  heroSnapshotCards: "/marketing/homepage-v3/hero-snapshot-cards.png",
  heroSnapshotTwo: "/marketing/homepage-v3/hero-snapshot-two.png",

  // §3 Your Venue. Your Way. — approved editorial photograph
  venueYourWayEditorial: "/marketing/venue-your-way-editorial.jpg",
  // Preserved product captures (unused in §3 editorial layout)
  setupHub: "/marketing/homepage-v3/setup-hub.png",
  brochure: "/marketing/homepage-v3/brochure.png",

  // Flagship Olivia & James wedding website (Sandbox — preserve photography/design)
  wwDesktop: "/marketing/homepage-v3/ww-desktop.png",
  wwMobile: "/marketing/homepage-v3/ww-mobile.png",
  wwGallery: "/marketing/homepage-v3/ww-gallery.png",

  // §4 operations — approved panoramic editorial
  operationsVenueReady: "/marketing/operations-venue-ready.png",
  // Preserved product captures (unused in §4 editorial layout)
  pipeline: "/marketing/homepage-v3/proof-pipeline.png",
  contracts: "/marketing/homepage-v3/contracts.png",
  portalTasks: "/marketing/homepage-v3/portal-tasks.png",
  floorPlan: "/marketing/homepage-v3/floor-plan.png",
  seatingChart: "/marketing/homepage-v3/seating-chart.png",
  timeline: "/marketing/homepage-v3/timeline-day-sheet.png",

  // §5 ecosystem — approved editorial audience portraits
  ecosystemVenue: "/marketing/ecosystem-venue.png",
  ecosystemClient: "/marketing/ecosystem-client.png",
  ecosystemVendor: "/marketing/ecosystem-vendor.png",
  // Preserved product captures (unused in §5 editorial layout)
  venueDashboard: "/marketing/homepage-v3/hero-dashboard.png",
  clientPortal: "/marketing/homepage-v3/proof-portal-desktop.png",
  vendorEventDetail: "/marketing/homepage-v3/vendor-event-detail.png",

  // §6 feature explorer (WW reserved for flagship placements — not a tiny tile)
  explorerSales: "/marketing/homepage-v3/proof-pipeline.png",
  explorerComm: "/marketing/homepage-v3/inbox.png",
  explorerClient: "/marketing/homepage-v3/portal-home.png",
  explorerOps: "/marketing/homepage-v3/floor-plan.png",
  explorerVendor: "/marketing/homepage-v3/vendor-packages.png",
  explorerPayments: "/marketing/homepage-v3/reporting.png",
  explorerCustom: "/marketing/homepage-v3/setup-hub.png",
  explorerLuv: "/marketing/homepage-v3/luv-assist.png",

  // §7 Getting Started — approved editorial workspace photograph
  gettingStartedEditorial: "/marketing/getting-started-editorial.png",

  // §8 Our First Friends — approved editorial keepsake photograph
  ourFirstFriendsEditorial: "/marketing/our-first-friends-editorial.png",

  // payments mobile (secondary)
  proofPaymentsMobile: "/marketing/homepage-v3/proof-payments-mobile.png",
} as const;

export type HomeAssetKey = keyof typeof HOME_ASSETS;

export const HOME_COPY = {
  hero: {
    eyebrow: "Wedding & Event Venue Management Software",
    headlineLine1: "Big capabilities.",
    headlineLine2: "Beautifully simple.",
    lede: "Run your venue your way, with less busywork and more control. From the first hello to the final cheers, everything comes together in one beautifully connected platform.",
    primaryCta: { href: "/product", label: "Explore the Platform" },
    secondaryCta: { href: "/walkthrough", label: "Schedule a Walkthrough" },
  },
  journey: {
    kicker: "One Connected Journey",
    headline: "From the first hello to the final cheers.",
    body: "Hello to Cheers brings the people, details, and work behind every event together—so everyone can do their part, without your team having to manage every moving piece.",
    steps: ["Inquire", "Tour", "Book", "Plan", "Celebrate"] as const,
    closing: "One venue. One connected process. Every detail moving forward.",
    moments: [
      {
        title: "The first hello",
        caption: "A new relationship begins.",
        alt: "Venue professional smiling while working at a laptop in a naturally lit workspace",
      },
      {
        title: "The work in between",
        caption: "Every detail comes together.",
        alt: "Venue coordinator, client, and florist collaborating over a floor plan",
      },
      {
        title: "The final cheers",
        caption: "A celebration worth remembering.",
        alt: "Guests laughing and raising glasses at an outdoor celebration",
      },
    ] as const,
  },
  personalize: {
    kicker: "Built Around Your Business",
    headline: "Your venue. Your way.",
    lede: "No two venues operate exactly alike. Your spaces, packages, policies, processes, and personality are what make your business yours. Your software should reflect that.",
    body: "Set up your venue, personalize your workspace, and prepare the tools and templates your team uses every day. Once your foundations are in place, HTC helps you put them to work across inquiries, bookings, planning, and event execution.",
    body2:
      "And you don't have to do it all alone. Give clients and vendors access to their own connected experiences, sharing the information and tools they need, when they need them. They can participate in the process while you stay in control.",
    closing: "Your business. Your process. Everyone working together.",
    configCaption: "Setup Hub — configure spaces, brand, and foundations",
    resultCaption: "Olivia & James wedding website — foundations as a polished client experience",
  },
  operations: {
    kicker: "From First Inquiry to Event Day",
    headline: "Everything in one place. Finally.",
    lede: "Bookings are just the beginning. Hello to Cheers brings sales, planning, collaboration, and event execution together in one connected platform.",
    phases: [
      {
        title: "Win the business",
        body: "Welcome inquiries, build relationships, manage tours, and keep opportunities moving toward a booking.",
      },
      {
        title: "Secure the booking",
        body: "Bring proposals, contracts, payments, and booking details together in one connected process.",
      },
      {
        title: "Manage the planning",
        body: "Give clients, vendors, and your team the tools to coordinate selections, floor plans, seating, and every detail in between.",
      },
      {
        title: "Deliver the event",
        body: "Keep timelines, event orders, inventory, and day-of details organized so everyone knows what comes next.",
      },
    ],
    featuresBridge: {
      headline: "Everything works better together.",
      body: "From your first inquiry to the final celebration, discover the tools that make it all possible.",
      cta: { href: "/features", label: "Explore All Features →" },
    },
  },
  ecosystem: {
    kicker: "Better Together",
    headline: "One event. Everyone connected.",
    lede: "Great events take more than one person. Hello to Cheers brings your team, your clients, and your vendors into one connected experience, with the right tools and information for each.",
    panels: [
      {
        role: "The Venue",
        title: "Your business. Your oversight.",
        body: "Manage your operations, guide the process, and keep everything moving without having to personally handle every detail.",
        img: "ecosystemVenue" as const,
        imgAlt:
          "Venue professional in a cream blazer holding a sage clipboard in a sunlit reception venue",
        position: "ecosystem-pos-venue",
      },
      {
        role: "The Client",
        title: "Their event. Their experience.",
        body: "Give clients a beautiful, connected place to make selections, manage planning details, and stay involved in bringing their event to life.",
        img: "ecosystemClient" as const,
        imgAlt:
          "Engaged couple reviewing event inspiration and planning materials together",
        position: "ecosystem-pos-client",
      },
      {
        role: "The Vendor",
        title: "Their expertise. Their part.",
        body: "Give vendors a place to share information, coordinate services, and contribute to the events they're helping create.",
        img: "ecosystemVendor" as const,
        imgAlt:
          "Professional florist in a sunlit studio arranging blush and ivory florals",
        position: "ecosystem-pos-vendor",
      },
    ],
    closing: "Everyone has a part to play. You don't have to play every part.",
  },
  // Preserved for Features redesign handoff — no longer rendered on homepage
  capabilities: {
    kicker: "A Closer Look at the Platform",
    headline: "All the tools. None of the chaos.",
    lede: "Everything you need to manage your venue, thoughtfully connected and ready to work together.",
    cta: { href: "/features", label: "Explore All Features" },
    entries: [
      {
        id: "sales",
        category: "Sales & Bookings",
        title: "Win & Book",
        body: "Capture inquiries, manage tours, create proposals, send contracts, and turn interest into confirmed bookings.",
      },
      {
        id: "communication",
        category: "Communication & Workflows",
        title: "Stay Connected",
        body: "Keep email, SMS, and portal conversations together, with automated workflows that help your team stay organized and keep things moving.",
      },
      {
        id: "client",
        category: "Client Planning & Collaboration",
        title: "Plan Together",
        body: "Give clients their own connected planning experience for tasks, questionnaires, selections, and shared event details.",
      },
      {
        id: "ops",
        category: "Event Planning & Operations",
        title: "Bring It All Together",
        body: "Coordinate floor plans, seating, timelines, event orders, inventory, and the details that make event day run smoothly.",
      },
      {
        id: "vendors",
        category: "Vendor Relationships & Collaboration",
        title: "Bring Vendors In",
        body: "Invite vendors into their own connected workspace, where they can manage their profiles, share availability, and coordinate their part of the event.",
      },
      {
        id: "payments",
        category: "Payments & Business Insights",
        title: "Know Your Business",
        body: "Manage invoices, payment schedules, and financial activity while keeping important business insights and reporting within reach.",
      },
      {
        id: "custom",
        category: "Customization & Helpful Assistance",
        title: "Make It Yours",
        body: "Personalize your spaces, offerings, templates, and processes, with optional help from Luv when you need it.",
      },
    ],
  },
  // Preserved interactive explorer data (component retained; not rendered on homepage §6)
  explorer: {
    kicker: "Thoughtfully Connected. Seriously Capable.",
    headline: "All the tools. None of the chaos.",
    lede: "Running a venue takes more than a calendar, a contact list, and a few contracts. It takes dozens of moving parts working together, often across months of planning.",
    body: "Hello to Cheers brings the tools you rely on into one organized workspace—so you can spend less time switching systems, repeating tasks, and tracking down information, and more time running your business.",
    cta: { href: "/features", label: "Explore All Features" },
    categories: [
      {
        id: "sales",
        title: "Sales & Bookings",
        body: "Manage leads, tours, availability, proposals, and contracts.",
        img: "explorerSales" as const,
        imgAlt: "Lead pipeline board",
      },
      {
        id: "communication",
        title: "Communication & Workflows",
        body: "Keep email, SMS, and portal conversations together, with automated workflows that help your team stay organized and keep things moving.",
        img: "explorerComm" as const,
        imgAlt: "Shared inbox for email, text, and portal conversations",
      },
      {
        id: "client",
        title: "Client Planning & Collaboration",
        body: "Give clients tools for budgets, wedding websites, RSVPs, and planning.",
        img: "explorerClient" as const,
        imgAlt: "Olivia and James client planning portal homepage",
      },
      {
        id: "ops",
        title: "Event Planning & Operations",
        body: "Coordinate layouts, seating, inventory, selections, timelines, and event day.",
        img: "explorerOps" as const,
        imgAlt: "Floor plan canvas with seating and layout tools",
      },
      {
        id: "vendors",
        title: "Vendor Relationships & Coordination",
        body: "Build your network and bring vendors into the process.",
        img: "explorerVendor" as const,
        imgAlt: "Flora & Branch vendor packages",
      },
      {
        id: "payments",
        title: "Payments & Business Insights",
        body: "Manage invoices, payment schedules, balances, and reporting.",
        img: "explorerPayments" as const,
        imgAlt: "Business reporting dashboard",
      },
      {
        id: "custom",
        title: "Customization & Helpful Assistance",
        body: "Make HTC your own, reuse what works, and use optional Luv assistance.",
        img: "explorerCustom" as const,
        imgAlt: "Setup Hub for venue configuration and templates",
      },
    ],
    defaultCategoryId: "ops",
  },
  gettingStarted: {
    kicker: "A Fresh Start, Without Starting Over",
    headline: "Switching shouldn't be the hard part.",
    subhead: "Set it up once. Make every event easier.",
    lede: "You've already built your business, your processes, and your relationships. Hello to Cheers helps you bring it all together in a workspace designed around you.",
    benefits: [
      {
        title: "Bring what you've built.",
        body: "Bring your existing contacts, event details, offerings, inventory, and more into one connected workspace.",
      },
      {
        title: "Get up and running.",
        body: "Follow a guided setup that helps you organize your information, prepare your workspace, and get ready to welcome your team and clients.",
      },
      {
        title: "You don't have to do it alone.",
        body: "We're here to help, and optional White Glove Setup is available if you'd rather we do it for you.",
      },
    ],
    cta: { href: "/getting-started", label: "Explore Getting Started" },
  },
  founder: {
    kicker: "A Little Heart Behind the Software",
    headline: "Built by people who know venues. Improved by people who listen.",
    body: "Before Hello to Cheers, we had the privilege of working alongside hundreds of wedding and event venues through another venue-management platform.",
    body2:
      "Those relationships taught us something important: the best software doesn't ask venues to change who they are or how they work. It makes the work easier, the experience better, and the people behind it feel supported.",
    body3:
      "That's the thinking behind Hello to Cheers. And it's why listening to the venues we serve will always be part of how we grow.",
    closing: "Independently built. Founder-led. Always listening.",
    cta: { href: "/our-story", label: "Get to Know Our Story" },
  },
  close: {
    kicker: "Ready for a Better Way?",
    headline: "See what Hello to Cheers can do for your venue.",
    lede: "You've built a business that's uniquely yours. We'd love to show you how Hello to Cheers can help you run it.",
    body: "Come see how everything can work together—from simplifying the day-to-day to connecting your people and managing every event, from the first hello to the final cheers.",
    note: "A closer look at the platform, with your venue's needs in mind.",
    primaryCta: { href: "/walkthrough", label: "Schedule a Walkthrough" },
  },
} as const;
