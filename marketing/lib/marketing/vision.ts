/**
 * Directional marketing copy for homepage vision exploration.
 * Tone: hospitality magazine — understood + connected — not SaaS feature dump.
 */

export const VISION_PHOTO = {
  estateGolden:
    "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=2000&q=80",
  barnLuxury:
    "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=2000&q=80",
  greenhouse:
    "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2000&q=80",
  coastal:
    "https://images.unsplash.com/photo-1499793983690-e8b21bebd9be?auto=format&fit=crop&w=2000&q=80",
  gardenCeremony:
    "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=2000&q=80",
  candleTablescape:
    "https://images.unsplash.com/photo-1478144592103-25e218a04891?auto=format&fit=crop&w=2000&q=80",
  receptionWarm:
    "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=2000&q=80",
  vineyardDusk:
    "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=2000&q=80",
  architectureStone:
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2000&q=80",
  flowersDetail:
    "https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1600&q=80",
  dashboard: "/marketing/product-dashboard.png",
} as const;

export const VISION = {
  brandLine: "Wevenu",
  understood: {
    script: "You were not looking for software.",
    headline: "You were looking for calm.",
    body: "Independent venues do not fail from lack of effort. They drown in disconnected tools, repeated questions, and nights spent chasing what should have been effortless. Wevenu exists so hospitality can feel like hospitality again.",
  },
  connected: {
    eyebrow: "Not integrated. Connected.",
    headline: "One continuous story.",
    continuum: [
      "One inquiry.",
      "One booking.",
      "One planning experience.",
      "One event.",
      "One financial record.",
      "One guest experience.",
      "One celebration.",
    ],
    proofLines: [
      "No duplicate entry.",
      "No syncing.",
      "No wondering which system is correct.",
    ],
    /** @deprecated use proofLines */
    proof:
      "No duplicate entry. No syncing. No wondering which system is correct.",
  },
  operations: [
    {
      id: "sales",
      title: "Sales",
      value: "Capture momentum without losing the personal touch.",
      groups: ["Inquiries & pipeline", "Tours", "Proposals", "Contracts"],
      photo: VISION_PHOTO.estateGolden,
    },
    {
      id: "planning",
      title: "Planning",
      value: "Collaborate with couples without chasing spreadsheets.",
      groups: ["Playbooks & tasks", "Timelines", "Documents", "Requests"],
      photo: VISION_PHOTO.gardenCeremony,
    },
    {
      id: "operations",
      title: "Operations",
      value: "Know what needs attention today — not what got buried yesterday.",
      groups: ["Calendar", "Floor plans", "Day-of run of show", "Staff clarity"],
      photo: VISION_PHOTO.barnLuxury,
    },
    {
      id: "financials",
      title: "Financials",
      value: "Packages, payments, and balances that stay honest.",
      groups: ["Packages", "Invoices", "Schedules", "Retainers"],
      photo: VISION_PHOTO.candleTablescape,
    },
    {
      id: "guest",
      title: "Guest Experience",
      value: "Not another wedding website — a guest experience connected to the venue.",
      groups: ["Website", "RSVP", "Portal", "Communication"],
      photo: VISION_PHOTO.receptionWarm,
    },
    {
      id: "vendors",
      title: "Vendor Network",
      value: "Invite vendors into the same celebration, with the right visibility.",
      groups: ["Invites", "COIs", "Messages", "Event access"],
      photo: VISION_PHOTO.vineyardDusk,
    },
    {
      id: "luv",
      title: "Hospitality Intelligence",
      value: "Scale hospitality without losing heart.",
      groups: ["Luv notices", "Gentle nudges", "Daily calm", "Included"],
      photo: VISION_PHOTO.flowersDetail,
    },
  ],
  triad: {
    eyebrow: "The differentiator",
    headline: "Venue. Couple. Vendor.",
    subhead: "Competitors own one or two. Wevenu owns all three — connected.",
    parties: [
      {
        name: "Venue",
        line: "The operating system for how your venue actually runs.",
      },
      {
        name: "Couple",
        line: "A planning experience that feels like your property, not a portal.",
      },
      {
        name: "Vendor",
        line: "Clear participation without another siloed inbox.",
      },
    ],
  },
  guestExperience: {
    script: "Don't sell a website.",
    headline: "Sell an experience guests can feel.",
    body: "Website, guest portal, RSVP, planning, timeline, communication, payments, and event details — working together because they already live inside the venue platform. That is what point solutions cannot replicate.",
  },
  luv: {
    eyebrow: "Meet Luv",
    headline: "Hospitality intelligence—not another assistant.",
    body: "Luv exists to help venues scale hospitality without losing heart.",
    lines: [
      "Real recommendations.",
      "Real conversations.",
      "Included with the platform—not bolted on later.",
    ],
  },
  journey: [
    { id: "inquiry", title: "Inquiry", emotion: "A first hello that feels personal." },
    { id: "tour", title: "Tour", emotion: "Time on property, remembered beautifully." },
    { id: "proposal", title: "Proposal", emotion: "A beautiful yes begins with a beautiful proposal." },
    { id: "contract-inventory", title: "Booking Confirmed", emotion: "Every promise becomes something your team can deliver." },
    { id: "invoice-payment", title: "Payments", emotion: "Money stays connected to the celebration." },
    { id: "planning", title: "Planning", emotion: "Everyone planning together—not everyone planning separately." },
    { id: "vendors", title: "Vendors", emotion: "Every partner, perfectly informed." },
    { id: "timeline", title: "Timeline", emotion: "The celebration is ready before the day begins." },
    { id: "floor-seating", title: "Floor Plans", emotion: "Every space prepared with confidence." },
    { id: "client-portal-website", title: "Client Experience", emotion: "Your hospitality doesn't stop after the tour." },
    { id: "guest-portal", title: "Guest Portal", emotion: "Every guest arrives a little more prepared." },
    { id: "celebration", title: "Celebration", emotion: "The celebration ends. The relationship doesn't." },
  ],
  cta: {
    headline: "Request a Walkthrough",
    body: "A calm conversation about your venue. No free trial. No pressure. Just clarity.",
  },
  closingDesire:
    "I've never seen a platform that actually understands how my venue operates.",
} as const;

export const CONCEPTS = [
  {
    id: "a",
    slug: "editorial",
    name: "Concept A",
    label: "Editorial Magazine",
    thesis: "High emotion, luxury hospitality — the story of running a venue, told like Kinfolk.",
  },
  {
    id: "b",
    slug: "immersive",
    name: "Concept B",
    label: "Immersive Keynote",
    thesis: "Giant product moments and sparse type — one idea per viewport.",
  },
  {
    id: "c",
    slug: "journey",
    name: "Concept C",
    label: "Interactive Booking Journey",
    thesis: "The homepage itself follows one booking from inquiry to celebration.",
  },
] as const;
