/**
 * Features Showroom — Concept A local preview data.
 * Isolated from the live /features catalog. Accurate capability language only.
 */

export type ShowroomFeaturedCapability = {
  id: string;
  label: string;
  detail: string;
  /** Optional screenshot swap when this capability is selected */
  imageSrc?: string;
  imageAlt?: string;
  /**
   * How the screenshot should fill the featured stage.
   * device = intentional phone-frame composition for tall client-facing UIs
   */
  imageFit?: "cover" | "contain" | "device";
};

export type ShowroomInventoryGroup = {
  heading: string;
  items: readonly string[];
};

export type ShowroomCollectionSpotlight = {
  eyebrow: string;
  headline: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
};

export type ShowroomEmailExample = {
  id: string;
  title: string;
  caption: string;
  imageSrc: string;
  imageAlt: string;
};

/** Editorial client-email showcase (Collection 02) — not a featured-exhibit swap. */
export type ShowroomEmailShowcase = {
  headline: string;
  introduction: string;
  examples: readonly ShowroomEmailExample[];
};

export type ShowroomCollection = {
  id: string;
  category: string;
  /** Short collection name used in the seven-collection navigation */
  title: string;
  /** Optional stage headline; falls back to title when omitted */
  headline?: string;
  explanation: string;
  benefit: string;
  imageSrc: string;
  imageAlt: string;
  imageNote?: string;
  /** list = numbered capability list; visual = thumbnail rail under the stage */
  featuredPresentation?: "list" | "visual";
  featured: readonly ShowroomFeaturedCapability[];
  inventory: readonly ShowroomInventoryGroup[];
  /** Optional editorial client-email examples (after featured exhibits, before Luv) */
  emailShowcase?: ShowroomEmailShowcase;
  /** Optional collection-scoped editorial spotlight (e.g. Luv for Communication) */
  spotlight?: ShowroomCollectionSpotlight;
};

const FS = "/marketing/features-showroom";

const ASSET = {
  /** Priority A — photography-rich brochure (distinct from homepage brochure.png). */
  brochureHero: `${FS}/brochure-editorial-hero.png`,
  brochurePreview: `${FS}/brochure-product-preview.png`,
  /** Ellie St. James commercial journey (Willow Grove). */
  ellieLead: `${FS}/ellie-lead-workspace.png`,
  ellieTours: `${FS}/ellie-tours-list.png`,
  ellieContract: `${FS}/ellie-contract-executed.png`,
  elliePackage: `${FS}/ellie-package-selection.png`,
  elliePackageChoice: `${FS}/ellie-package-choice.png`,
  /** Fresh Willow Grove client-facing captures (Sales gallery — v3b cache-bust; contract 16:10 + header headroom). */
  clientProposalChoose: `${FS}/wg-client-proposal-choose-package-v3.png`,
  clientContractSign: `${FS}/wg-client-contract-sign-v3b.png`,
  ellieInbox: `${FS}/ellie-inbox-journey.png`,
  /** Collection 02 — Stay Connected (Willow Grove authentic captures). */
  commsInbox: `${FS}/wg-comms-inbox-nora-v4.png`,
  commsTemplates: `${FS}/wg-comms-templates-inquiry-v1.png`,
  commsAutomations: `${FS}/wg-comms-automations-paused-v1.png`,
  commsLuvDraft: `${FS}/wg-comms-luv-draft-ellie-v1.png`,
  commsEmailProposal: `${FS}/wg-comms-email-proposal-v1.png`,
  commsEmailTour: `${FS}/wg-comms-email-tour-v3.png`,
  pipeline: `${FS}/pipeline-board.png`,
  automations: `${FS}/automations-paused.png`,
  messageTemplates: `${FS}/message-templates.png`,
  portalTasks: `${FS}/portal-tasks.png`,
  guestRsvp: `${FS}/hayes-guest-rsvp.png`,
  portalDocs: `${FS}/portal-docs.png`,
  questionnaires: `${FS}/hayes-questionnaires.png`,
  /** Collection 03 — Plan Together (Willow Grove authentic captures). */
  clientQuestionnaire: `${FS}/wg-client-questionnaire-v11.png`,
  clientWeddingWebsite: `${FS}/wg-client-wedding-website-v1.png`,
  clientPortalHome: `${FS}/wg-client-portal-home-v1.png`,
  clientVenueGuide: `${FS}/wg-client-venue-guide-v1.png`,
  /** Collection 04 — Bring It All Together (Willow Grove authentic captures). */
  eventOrder: `${FS}/wg-ops-event-order-v7d.png`,
  seating: `${FS}/wg-ops-seating-c04-chart-v3.png`,
  eventSpaces: `${FS}/wg-ops-event-spaces-v2.png`,
  calendarOps: `${FS}/wg-ops-calendar-v2.png`,
  timelineOps: `${FS}/wg-ops-timeline-v7b.png`,
  opsSpotlight: `${FS}/wg-ops-spotlight-venue-ops-v3.jpg`,
  floraEvent: `${FS}/flora-hayes-event.png`,
  vendorsDirectory: `${FS}/vendors-directory.png`,
  /** Collection 05 — Bring Vendors In (Willow Grove / Flora authentic captures). */
  vendorsFloraEvent: `${FS}/wg-vendors-flora-hayes-event-v1.png`,
  vendorsDirectoryV1: `${FS}/wg-vendors-directory-v1.png`,
  vendorsFloraFaqs: `${FS}/wg-vendors-flora-faqs-v3.png`,
  vendorsFloraPackages: `${FS}/wg-vendors-flora-packages-v1.png`,
  vendorsFloraAvailability: `${FS}/wg-vendors-flora-availability-v1.png`,
  vendorsFloraTasks: `${FS}/wg-vendors-flora-hayes-tasks-v1.png`,
  vendorsSpotlight: `${FS}/wg-vendors-spotlight-floral-prep-v1.jpg`,
  portalPayments: `${FS}/hayes-portal-payments.png`,
  paymentsList: `${FS}/payments-list.png`,
  reporting: `${FS}/reporting.png`,
  /** Collection 06 — Know Your Business (Willow Grove / Hayes authentic). */
  paymentsVenuePlan: `${FS}/wg-payments-hayes-venue-plan-v1.png`,
  paymentsClientInvoice: `${FS}/wg-payments-hayes-client-invoice-v1.png`,
  paymentsPortalPay: `${FS}/wg-payments-hayes-portal-pay-v1.png`,
  /** Collection 06 Exhibit 03 — Hayes couple portal Home Payments card (Pay Now). */
  paymentsPortalHomePay: `${FS}/wg-payments-hayes-portal-home-pay-v1.png`,
  /** Retained prior Stripe Checkout capture (not featured). */
  paymentsStripeCheckout: `${FS}/wg-payments-hayes-stripe-checkout-v1.png`,
  paymentsReporting: `${FS}/wg-payments-reporting-v1.png`,
  paymentsIntegrations: `${FS}/wg-payments-integrations-stripe-qbo-v1.png`,
  paymentsSpotlight: `${FS}/wg-payments-spotlight-planning-desk-v1.jpg`,
  brandingLogo: `${FS}/venue-branding-logo.png`,
  /** Collection 07 — 2× Sandbox recapture: Venue Logo + Wedding Home Photo (retina-safe). */
  customVenueBranding: `${FS}/wg-custom-venue-branding-v2.png`,
  /** Collection 07 — Reusable Assets & Catalogs with full Saved Reports + bottom pad (retina-safe). */
  customReusableCatalogs: `${FS}/wg-custom-reusable-catalogs-v3b.png`,
  /** Collection 07 — 2× Sandbox recapture of Brand colors (retina-safe). */
  brandColors: `${FS}/wg-custom-brand-colors-v2.png`,
  luvControls: `${FS}/luv-controls.png`,
  setupProfiles: `${FS}/setup-profiles.png`,
  libraryTemplates: `${FS}/library-templates.png`,
  setupHub: `${FS}/setup-hub.png`,
  /** Supporting reuse where a dedicated Features capture is not featured. */
  calendarTours: `${FS}/wg-ops-calendar-v2.png`,
  messaging: "/marketing/homepage-v3/messaging.png",
  vendorPackages: "/marketing/homepage-v3/vendor-packages.png",
  vendorTasks: "/marketing/homepage-v3/vendor-event-tasks.png",
  vendorPartnerships: "/marketing/homepage-v3/vendor-partnerships.png",
  invoices: "/marketing/homepage-v3/invoices.png",
  settingsTeam: "/marketing/homepage-v3/settings-team.png",
  /** Intentionally not featured as primaries (Product / Home overlap). */
  portalHome: "/marketing/homepage-v3/portal-home.png",
  floorPlan: "/marketing/homepage-v3/floor-plan.png",
  timeline: `${FS}/wg-ops-timeline-v6.png`,
  wwDesktop: "/marketing/homepage-v3/ww-desktop.png",
} as const;

/**
 * Visual Pass 1 asset notes — Features-local library under features-showroom/.
 */
export const SHOWROOM_ASSET_REUSE_NOTES = [
  "brochure-editorial-hero.png — Willow Grove brochure photography crop (distinct from homepage brochure.png)",
  "ellie-* — Ellie St. James & Colby Thornton commercial journey (Willow Grove Sandbox)",
  "hayes-* / flora-hayes-event — Olivia & James Hayes planning, RSVP, vendor collaboration",
  "wg-ops-* — Collection 04 ops captures (Hayes EO/timeline read-only; disposable C04 seating fixture; Nov 2026 calendar)",
  "wg-vendors-* — Collection 05 Flora × Willow Grove captures (event, directory, FAQs v3 tight crop, availability, tasks) + floral spotlight",
  "wg-payments-* — Collection 06 Hayes venue plan / client invoice / portal Home Pay Now / Reports / Stripe+QBO settings + planning-desk spotlight",
  "wg-custom-venue-branding-v2 / wg-custom-brand-colors-v2 — Collection 07 retina-safe branding/colors (approved)",
  "wg-custom-reusable-catalogs-v3b — Collection 07 catalogs framing with full Saved Reports card + bottom breathing room",
  "venue-branding-logo / venue-brand-colors / luv-controls — user-original Setup & Luv captures (branding/colors superseded in C07 gallery by v2 assets)",
  "messaging.png, vendor-packages, invoices, settings-team — supporting homepage-v3 reuse only where no stronger Features frame exists",
  "portal-home, floor-plan, ww-desktop — retained for fallback; not used as Features primaries",
] as const;

/**
 * Phase 3A Features hero — approved editorial copy.
 * Photography: Features-only golden-hour garden tablescape (not reused from Homepage).
 */
export const FEATURES_HERO = {
  eyebrow: "The Complete Collection",
  headline: "So much more than meets the eye.",
  body: "From the first inquiry to the final farewell, every detail has a place. Explore the tools, thoughtful touches, and connected experiences that make Hello to Cheers your own.",
  exploreLabel: "Explore the collection",
  showroomAnchorId: "features-showroom",
  imageSrc: "/marketing/features-hero-golden-hour-garden.jpg",
  imageAlt:
    "Golden-hour garden wedding table with blush florals, crystal glassware, and candlelight",
  imageSourceNote:
    "Features hero photograph: marketing/public/marketing/features-hero-golden-hour-garden.jpg",
} as const;

export const FEATURES_SHOWROOM = {
  previewEyebrow: "Features · Concept Preview",
  previewNote:
    "Temporary showroom preview for visual direction. The live Features page is unchanged.",
  defaultCollectionId: "sales",
  collections: [
    {
      id: "sales",
      category: "Sales & Bookings",
      title: "Inquiry to Booked",
      headline: "From inquiry to booked, beautifully connected.",
      explanation:
        "Welcome new inquiries, schedule tours, present your offerings, and guide couples through proposals, signatures, and payments—all in one connected experience.",
      benefit:
        "Every step stays attached to the same lead—so your team can move from first hello to booked with confidence, then begin personalized planning with the right resources already in place.",
      imageSrc: ASSET.brochureHero,
      imageAlt:
        "The Willow Grove venue brochure with photography-rich editorial spreads for packages and property",
      featured: [
        {
          id: "brochures",
          label: "A beautiful first impression",
          detail:
            "Present your venue, spaces, and offerings in a polished, customizable brochure.",
          imageSrc: ASSET.brochureHero,
          imageAlt: "The Willow Grove shareable venue brochure with photography and packages",
          imageFit: "cover",
        },
        {
          id: "lead-workspace",
          label: "Every conversation in context",
          detail:
            "Keep inquiries, tours, proposals, and booking progress connected in one lead workspace.",
          imageSrc: ASSET.ellieLead,
          imageAlt:
            "Ellie St. James lead workspace at The Willow Grove with tours, offers, and next steps",
          imageFit: "cover",
        },
        {
          id: "packages",
          label: "Let them choose what feels right",
          detail:
            "Give couples a clear, inviting way to explore and select their preferred package.",
          imageSrc: ASSET.clientProposalChoose,
          imageAlt:
            "The Willow Grove client proposal showing Essential and Signature packages with prices and Approve my selection",
          imageFit: "device",
        },
        {
          id: "contracts",
          label: "Make it official",
          detail:
            "Couples review their venue agreement and sign electronically—then the venue countersigns to finalize.",
          imageSrc: ASSET.clientContractSign,
          imageAlt:
            "Client electronic signature step for a Willow Grove venue rental agreement, before venue countersignature",
          imageFit: "contain",
        },
      ],
      inventory: [
        {
          heading: "Attract & organize",
          items: [
            "Lead management",
            "Inquiry forms",
            "Website lead capture",
            "Lead pipeline",
            "Lead assignment",
            "Activity & conversation history",
            "Facebook & Instagram Lead Ads connection",
          ],
        },
        {
          heading: "Guide the booking",
          items: [
            "Tour scheduling & confirmations",
            "Availability inquiries",
            "Holds",
            "Packages & offerings",
            "Shareable brochures",
            "Proposals & client package selection",
            "Contracts & electronic signatures",
            "Payment plans & arrangements",
            "Online payments",
            "Booking confirmation & transition into planning",
            "Booking management",
          ],
        },
        {
          heading: "Move work forward",
          items: [
            "Automated follow-up sequences",
            "Email & message templates",
            "Reusable sales templates",
            "Payment plans prepared at booking",
            "Connected lead workspace",
          ],
        },
      ],
    },
    {
      id: "communication",
      category: "Communication & Workflows",
      title: "Stay Connected",
      explanation:
        "Stay close to your clients without becoming overwhelmed by messages, repetitive follow-ups, or disconnected tools—keeping the human relationship at the center.",
      benefit:
        "Fewer missed messages. Clearer follow-through. One place to see what was said and what comes next.",
      imageSrc: ASSET.commsInbox,
      imageAlt:
        "Willow Grove Inbox with Nora & Theo Wells loaded, conversation list ready, and Email / Text / Portal channels visible",
      featured: [
        {
          id: "inbox",
          label: "Every conversation, in one place",
          detail:
            "Keep email, text, and portal conversations connected to the people and events they belong to.",
          imageSrc: ASSET.commsInbox,
          imageAlt:
            "Willow Grove Unified Inbox showing Nora & Theo Wells, a loaded conversation list, and Email, Text, and Portal message channel choices",
          imageFit: "cover",
        },
        {
          id: "templates",
          label: "A thoughtful touch, already prepared",
          detail: "Start with reusable messages, then make every note feel personal.",
          imageSrc: ASSET.commsTemplates,
          imageAlt:
            "Willow Grove message template editor with personalized merge fields for New Inquiry Response",
          imageFit: "cover",
        },
        {
          id: "automations",
          label: "The right follow-up, at the right time",
          detail:
            "Prepare follow-up sequences that work on your terms—pause or adjust whenever you need.",
          imageSrc: ASSET.commsAutomations,
          imageAlt:
            "Willow Grove Automations with sales and client sequences paused until the venue is ready",
          imageFit: "cover",
        },
      ],
      emailShowcase: {
        headline: "Every message is part of the experience.",
        introduction:
          "From the first invitation to the next thoughtful detail, your clients receive clear, beautifully presented communications that feel like an extension of your venue.",
        examples: [
          {
            id: "proposal-email",
            title: "A proposal worth opening",
            caption:
              "Invite clients to explore their options and choose what feels right.",
            imageSrc: ASSET.commsEmailProposal,
            imageAlt:
              "Willow Grove client email inviting Ellie to review a proposal and choose a package",
          },
          {
            id: "tour-email",
            title: "A welcome before they arrive",
            caption:
              "Make every visit feel thoughtfully arranged, with the details and calendar access clients need.",
            imageSrc: ASSET.commsEmailTour,
            imageAlt:
              "Willow Grove tour confirmation email with appointment details and Add to Calendar",
          },
        ],
      },
      inventory: [
        {
          heading: "Conversations",
          items: [
            "Unified Inbox",
            "Email communication",
            "SMS / text messaging",
            "Client portal messaging",
            "Internal notes (venue-side view only)",
            "Conversation history on leads & events",
            "Delivery status on outbound messages",
          ],
        },
        {
          heading: "Preparation & follow-up",
          items: [
            "Message templates",
            "Personalization / merge fields",
            "Scheduled messages (email & text)",
            "Automated follow-up sequences",
            "Trigger-based workflows",
            "Automation pause & control",
            "Follow-up reminders",
            "Notification preferences",
            "Luv follow-up suggestions",
            "Luv reviewable drafts (you send)",
          ],
        },
      ],
      spotlight: {
        eyebrow: "A LITTLE HELP FROM LUV",
        headline: "A little help from Luv. A lot more room for the human touch.",
        body: "Luv can notice when a follow-up might help and prepare a draft for your review. You choose the words—and you send them.",
        imageSrc: ASSET.commsLuvDraft,
        imageAlt:
          "Luv draft-for-review on Ellie St. James at The Willow Grove—editable subject and body, with clear notice that Luv does not send",
      },
    },
    {
      id: "client",
      category: "Client Planning & Collaboration",
      title: "Plan Together",
      explanation:
        "Give clients a branded planning experience for tasks, questionnaires, selections, documents, and their wedding website—connected to your venue the whole way.",
      benefit:
        "Clients gain confidence and independence. Your team spends less time chasing answers.",
      imageSrc: ASSET.portalTasks,
      imageAlt: "Olivia & James Hayes client portal planning tasks with progress",
      featured: [
        {
          id: "tasks",
          label: "Shared planning tasks",
          detail: "Clear next steps for clients, with progress your team can see.",
          imageSrc: ASSET.portalTasks,
          imageAlt: "Client portal planning tasks for Olivia & James Hayes",
        },
        {
          id: "rsvp",
          label: "Guest lists & RSVPs",
          detail: "Track responses, meal selections, and guest details in one place.",
          imageSrc: ASSET.guestRsvp,
          imageAlt: "Hayes wedding guest RSVP dashboard with response tracking",
        },
        {
          id: "questionnaires",
          label: "Questionnaires & choices",
          detail: "Gather the details that make every celebration personal.",
          imageSrc: ASSET.clientQuestionnaire,
          imageAlt:
            "Willow Grove Client Planning Questionnaire with thoughtful questions, written answers, and choice options",
          imageFit: "cover",
        },
        {
          id: "website",
          label: "Wedding websites & personal touches",
          detail: "Give every celebration its own beautiful place to share the details.",
          imageSrc: ASSET.clientWeddingWebsite,
          imageAlt:
            "Olivia & James Hayes wedding website at The Willow Grove with couple names, date, and celebration story",
          imageFit: "cover",
        },
        {
          id: "payments",
          label: "Client payment access",
          detail: "Couples can see what's paid, what's next, and how to pay.",
          imageSrc: ASSET.portalPayments,
          imageAlt: "Hayes client portal payment schedule and balances",
        },
      ],
      inventory: [
        {
          heading: "Client workspace",
          items: [
            "Branded client portal",
            "Planning tasks",
            "Planning progress",
            "Portal messages",
            "Shared documents",
            "Client payment access",
            "Client timelines",
          ],
        },
        {
          heading: "Decisions & celebration details",
          items: [
            "Questionnaires",
            "Selections & choices",
            "Guest lists",
            "RSVP management",
            "Meal selections",
            "Budgets",
            "Wedding websites",
            "Website Studio customization",
            "Personal planning tools",
          ],
        },
      ],
      spotlight: {
        eyebrow: "THE CLIENT EXPERIENCE",
        headline: "Their celebration. Your thoughtful guidance.",
        body: "From planning tasks and guest responses to personal decisions and shared details, clients have a place to make progress at their own pace.\n\nYour team stays connected to what matters, without managing every detail through another email.",
        imageSrc: ASSET.clientVenueGuide,
        imageAlt:
          "Willow Grove client portal Venue Guide with Guide tab selected, venue photograph, Our Story, search, and About the Venue",
      },
    },
    {
      id: "ops",
      category: "Event Planning & Operations",
      title: "Bring It All Together",
      explanation:
        "Coordinate spaces, seating, timelines, event orders, inventory, and day-of details so everyone knows what comes next—and the celebration feels effortless.",
      benefit:
        "Operational clarity compounds: what clients choose, what vendors need, and what your team executes stay connected.",
      imageSrc: ASSET.eventOrder,
      imageAlt:
        "Willow Grove Event Order for Olivia & James Hayes with package, catering selections, and bar commitments",
      featured: [
        {
          id: "eventorders",
          label: "Event orders & selections",
          detail: "Turn client selections into a clear plan for what your team will deliver.",
          imageSrc: ASSET.eventOrder,
          imageAlt:
            "Finalized Event Order for Olivia & James Hayes with client-submitted selections, package coverage, and catering choices",
        },
        {
          id: "seating",
          label: "Seating charts",
          detail: "Arrange guests with the same event context your team already trusts.",
          imageSrc: ASSET.seating,
          imageAlt:
            "Carriage House reception seating chart with balanced tables and guest assignments",
        },
        {
          id: "spaces",
          label: "Venue spaces & capacity",
          detail: "Keep physical spaces and event assignments clear across the calendar.",
          imageSrc: ASSET.eventSpaces,
          imageAlt:
            "Willow Grove Event Spaces configured for Garden Lawn, Carriage House, and Grove Pavilion",
        },
        {
          id: "calendar",
          label: "Calendar & availability",
          detail:
            "See events, tours, appointments, holds, and blocked dates in one view.",
          imageSrc: ASSET.calendarOps,
          imageAlt:
            "Willow Grove calendar showing events, tours, appointments, and blocked time with space filters",
        },
        {
          id: "timelines",
          label: "Event timelines",
          detail: "Build the run of show your team and partners can follow.",
          imageSrc: ASSET.timelineOps,
          imageAlt:
            "Hayes Timeline workspace with venue access, ceremony, cocktail hour, reception, and load-out milestones",
        },
      ],
      inventory: [
        {
          heading: "Spaces & logistics",
          items: [
            "Event spaces",
            "Capacity & availability",
            "Calendar",
            "Holds & blocked dates",
            "Floor plans",
            "Seating charts",
            "Inventory & rentals",
          ],
        },
        {
          heading: "Execution",
          items: [
            "Event Orders",
            "Client selections",
            "Event timelines",
            "Day-of Sheets",
            "Venue planning tasks",
            "Team coordination",
            "Event notes",
          ],
        },
      ],
      spotlight: {
        eyebrow: "BEHIND EVERY BEAUTIFUL CELEBRATION",
        headline: "A clear picture of everything happening.",
        body: "From the first preparations to the final farewell, your team has countless details to coordinate. Hello to Cheers keeps schedules, spaces, selections, and responsibilities connected, so everyone can focus on bringing the celebration together.",
        imageSrc: ASSET.opsSpotlight,
        imageAlt:
          "Finishing touches on an event tablescape—soft florals, linens, and place settings ready before guests arrive",
      },
    },
    {
      id: "vendors",
      category: "Vendor Relationships & Collaboration",
      title: "Bring Vendors In",
      explanation:
        "Invite vendors into their own connected workspace—profiles, availability, packages, tasks, and event details—so coordination stops living in endless email threads.",
      benefit:
        "Partners stay informed and accountable. Your team spends less time being the messenger.",
      imageSrc: ASSET.vendorsFloraEvent,
      imageAlt:
        "Flora & Branch event workspace for the Olivia & James Hayes wedding at The Willow Grove—arrival, load-in, and day-of responsibilities",
      featured: [
        {
          id: "event",
          label: "Event-specific vendor workspace",
          detail:
            "Partners see the celebration they're supporting, with the details they need to deliver.",
          imageSrc: ASSET.vendorsFloraEvent,
          imageAlt:
            "Flora & Branch Hayes event overview with arrival time, setup location, load-in notes, and open tasks",
        },
        {
          id: "directory",
          label: "Directory & preferred vendors",
          detail: "Build and manage the trusted network your venue recommends.",
          imageSrc: ASSET.vendorsDirectoryV1,
          imageAlt:
            "Willow Grove vendor directory showing Preferred, Required, Recommended, and Claimed partners",
        },
        {
          id: "profile",
          label: "Vendor profiles, packages & FAQs",
          detail: "Give partners a place to share their services and answer common questions.",
          imageSrc: ASSET.vendorsFloraFaqs,
          imageAlt:
            "Flora & Branch vendor Profile FAQs—six florist questions covering outdoor ceremonies, design finalization, delivery, ceremony-to-reception transfers, seasonal stems, and venue coordination",
        },
        {
          id: "availability",
          label: "Vendor availability calendar",
          detail:
            "Let partners manage their availability so everyone can plan with greater confidence.",
          imageSrc: ASSET.vendorsFloraAvailability,
          imageAlt:
            "Flora & Branch availability calendar with month view, blocked dates, and booking openness settings",
          imageFit: "contain",
        },
        {
          id: "tasks",
          label: "Vendor assignments & responsibilities",
          detail: "Keep responsibilities, due dates, and shared details clear for every partner.",
          imageSrc: ASSET.vendorsFloraTasks,
          imageAlt:
            "Flora & Branch Hayes event Tasks with assigned work, due dates, and coordination details",
        },
      ],
      inventory: [
        {
          heading: "Relationships",
          items: [
            "Vendor directory & network",
            "Preferred & required vendors",
            "Vendor invitations & claiming",
            "Vendor inquiries",
            "Couple vendor selection from your directory",
            "Venue partnerships",
            "Vendor profiles, packages & FAQs",
          ],
        },
        {
          heading: "Collaboration",
          items: [
            "Dedicated vendor portal",
            "Event assignments",
            "Event-specific information",
            "Vendor availability calendar",
            "Vendor messaging",
            "Shared documents & timelines",
            "Vendor tasks & responsibilities",
            "Day-of arrival & setup updates",
          ],
        },
      ],
      spotlight: {
        eyebrow: "THE PEOPLE BEHIND THE CELEBRATION",
        headline: "A better way to work together.",
        body: "Florists, caterers, photographers, and every partner who brings a celebration to life deserve to feel informed and included. Hello to Cheers gives them the details, tools, and connections they need—without putting your venue in the middle of every conversation.",
        imageSrc: ASSET.vendorsSpotlight,
        imageAlt:
          "Florist’s hands arranging garden roses and eucalyptus on a wooden prep table before a celebration",
      },
    },
    {
      id: "payments",
      category: "Payments & Business Insights",
      title: "Know Your Business",
      explanation:
        "Manage invoices, payment schedules, and financial activity while keeping the reporting that helps you understand bookings, revenue, and what’s ahead.",
      benefit:
        "From the first deposit to the final balance, every payment has its place—and your business has a clearer picture.",
      imageSrc: ASSET.paymentsVenuePlan,
      imageAlt:
        "Willow Grove venue invoice and payment plan for the Olivia & James Hayes Celebration Package—$18,500 contracted with balances and next installment",
      featured: [
        {
          id: "schedules",
          label: "Payment plans & schedules",
          detail:
            "Keep deposits, installments, balances, and payment milestones connected to every celebration.",
          imageSrc: ASSET.paymentsVenuePlan,
          imageAlt:
            "Venue-side Celebration Package invoice showing Partially Paid status, $18,500 contracted, paid to date, remaining balance, and next payment",
          imageFit: "contain",
        },
        {
          id: "invoices",
          label: "Invoices & tracking",
          detail:
            "Create clear invoices with charges, payments, and outstanding balances in one place.",
          imageSrc: ASSET.paymentsClientInvoice,
          imageAlt:
            "Customer-facing Celebration Package invoice and payment plan for Olivia & James Hayes with installment schedule",
          imageFit: "contain",
        },
        {
          id: "collection",
          label: "Online payment collection",
          detail:
            "Give clients a convenient way to pay online, with payments connected to their event.",
          imageSrc: ASSET.paymentsPortalHomePay,
          imageAlt:
            "Willow Grove couple portal Home — Payments card with remaining balance, next Planning installment, and Pay Now",
          imageFit: "contain",
        },
        {
          id: "reporting",
          label: "Reporting & insights",
          detail: "See bookings, sales activity, and revenue patterns in one place.",
          imageSrc: ASSET.paymentsReporting,
          imageAlt:
            "Willow Grove Reports overview with bookings, sales, revenue, and event reporting tabs",
        },
        {
          id: "integrations",
          label: "Accounting connections",
          detail:
            "Connect payment processing and accounting tools without losing the event context.",
          imageSrc: ASSET.paymentsIntegrations,
          imageAlt:
            "Willow Grove Settings showing Stripe connected for card and ACH payments, with QuickBooks Online available to connect",
          imageFit: "contain",
        },
      ],
      inventory: [
        {
          heading: "Money in motion",
          items: [
            "Contracts & electronic signatures",
            "Invoices",
            "Payment plans",
            "Online payment collection (Stripe)",
            "Manual / offline payment recording",
            "Partial payments",
            "Payment tracking",
            "Refund management",
          ],
        },
        {
          heading: "Business clarity",
          items: [
            "Reporting",
            "QuickBooks Online integration",
            "Team roles & permissions",
            "Data management & exports",
          ],
        },
      ],
      spotlight: {
        eyebrow: "THE BUSINESS BEHIND THE BEAUTIFUL MOMENTS",
        headline: "A clearer picture of your business.",
        body: "Every celebration comes with financial details to manage. From deposits and payment schedules to reporting and accounting, Hello to Cheers keeps the numbers connected to the people and events behind them.",
        imageSrc: ASSET.paymentsSpotlight,
        imageAlt:
          "Venue planning desk with leather notebook, brass pen, and a small vase of roses overlooking a softly lit reception room",
      },
    },
    {
      id: "custom",
      category: "Customization & Helpful Assistance",
      title: "Make It Yours",
      explanation:
        "Personalize spaces, offerings, templates, branding, and processes—then reuse what works. Optional help from Luv when you want a thoughtful nudge, never a takeover.",
      benefit:
        "Hello to Cheers adapts to your venue’s way of working, so every new event starts ahead—not from scratch.",
      imageSrc: ASSET.customVenueBranding,
      imageAlt: "Willow Grove venue branding with logo and venue photography",
      featured: [
        {
          id: "branding",
          label: "Venue branding",
          detail: "Logo, photography, and identity that show up where clients meet your brand.",
          imageSrc: ASSET.customVenueBranding,
          imageAlt:
            "Willow Grove Business & Brand settings showing daisy logo, nav and portal previews, and Wedding Home Photo",
          imageFit: "contain",
        },
        {
          id: "colors",
          label: "Brand colors",
          detail: "A palette that carries through client-facing experiences.",
          imageSrc: ASSET.brandColors,
          imageAlt: "Venue brand color settings for The Willow Grove",
        },
        {
          id: "templates",
          label: "Reusable catalogs & assets",
          detail:
            "Build your offerings, packages, inventory, brochures, and more once—then draw on them throughout your venue.",
          imageSrc: ASSET.customReusableCatalogs,
          imageAlt:
            "Willow Grove Templates — Reusable Assets & Catalogs with Offerings, Packages, Available Inventory, Public Forms, QR Campaigns, and Brochures",
          imageFit: "contain",
        },
        {
          id: "setup",
          label: "Setup Hub & profiles",
          detail: "A guided place to bring your venue’s foundations into the workspace.",
          imageSrc: ASSET.setupProfiles,
          imageAlt: "Setup Profiles with Signature Wedding Setup and included resources",
        },
        {
          id: "luv",
          label: "Luv · optional assistance",
          detail:
            "Drafting help and venue controls you review—assistance that never sends on its own.",
          imageSrc: ASSET.luvControls,
          imageAlt: "Luv drafting and venue control settings",
        },
      ],
      inventory: [
        {
          heading: "Your venue identity",
          items: [
            "Venue branding & logo",
            "Brand colors",
            "Venue photography",
            "Brochures",
            "Packages & offerings",
            "Customizable venue information",
            "Client-facing materials",
            "Setup Hub",
            "Team roles & permissions",
            "Notification preferences",
          ],
        },
        {
          heading: "Reuse what works",
          items: [
            "Reusable templates",
            "Setup Profiles",
            "Planning templates",
            "Timeline & floor plan templates",
            "Questionnaire templates",
            "Event order templates",
            "Playbooks",
          ],
        },
        {
          heading: "Luv (optional)",
          items: [
            "Luv AI assistance",
            "Luv drafting & review",
            "Venue Luv controls",
            "Daily briefings & observations",
            "Smart reminders",
          ],
        },
      ],
    },
  ] as const satisfies readonly ShowroomCollection[],
} as const;

export type ShowroomCollectionId = (typeof FEATURES_SHOWROOM.collections)[number]["id"];

export function getShowroomCollection(
  id: string | null | undefined,
): ShowroomCollection {
  const collections = FEATURES_SHOWROOM.collections;
  // Widen from the const-tuple union so optional collection fields
  // (headline, featuredPresentation, emailShowcase, spotlight, imageFit)
  // are available without discarding the ShowroomCollection contract.
  return (
    collections.find((c) => c.id === id) ??
    collections.find((c) => c.id === FEATURES_SHOWROOM.defaultCollectionId) ??
    collections[0]
  );
}
