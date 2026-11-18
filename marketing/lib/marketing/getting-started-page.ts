/**
 * Getting Started marketing page — approved five-section creative direction.
 * Copy is locked; do not rewrite or substitute alternate messaging.
 */

export const GETTING_STARTED_ASSETS = {
  hero: "/marketing/getting-started/getting-started-hero.jpg",
  importEntry: "/marketing/getting-started/getting-started-import-entry.png",
  connectedWorkspace: "/marketing/getting-started/getting-started-connected-workspace.png",
  setupHub: "/marketing/getting-started/getting-started-setup-hub-overview.png",
  practiceVenue: "/marketing/getting-started/getting-started-practice-venue-v3.png",
  practiceClient: "/marketing/getting-started/getting-started-practice-client-v3.png",
} as const;

export const GETTING_STARTED_PAGE = {
  meta: {
    title: "Getting Started",
    description:
      "Bring your venue business into Hello to Cheers — from connected client and event history to personalized setup and a real Practice Run before you go live.",
  },
  hero: {
    eyebrow: "GETTING STARTED",
    headline: "And here's the best part.",
    support: "Getting started is easier than you think.",
    body: "Bring your business with you, make Hello to Cheers your own, and explore the experience before you invite a single client. We've thought carefully about every step, so you can spend less time getting set up and more time enjoying what's ahead.",
    primaryCta: { href: "#bring-your-business", label: "See how it works" },
    secondaryCta: { href: "/walkthrough", label: "Schedule a Walkthrough" },
    imageAlt:
      "Venue owner smiling at a laptop in a sunlit hospitality office with florals and a garden view",
  },
  bringYourBusiness: {
    id: "bring-your-business",
    eyebrow: "BRING YOUR BUSINESS",
    headline: "Not just your contacts. Your whole world of events.",
    intro:
      "Your business is so much more than a list of names. Hello to Cheers helps bring over the details that make everything work together — your clients, celebrations, commitments, financial history, and planning resources — and connects supported information to the places where you'll actually use it.",
    groups: [
      {
        title: "Your people and celebrations",
        body: "Bring your leads, clients, events, and preferred vendors together, keeping important relationships and event history connected.",
      },
      {
        title: "Your agreements and financial history",
        body: "Bring contracts, invoices, payment schedules, and recorded payments into the appropriate event workspaces, with supported history reflected in relevant reporting.",
      },
      {
        title: "Your planning details",
        body: "Bring tasks, timelines, questionnaires, documents, floor-plan files, and other supported planning materials into the celebrations they belong to.",
      },
    ],
    emphasis: [
      "Not just imported.",
      "Connected and ready to work.",
    ] as const,
    emphasisBody:
      "Instead of starting with scattered files and rebuilding everything by hand, you can pick up with your information organized inside Hello to Cheers. Review matches, confirm details, and continue with the tools and history already brought together.",
    reassurance: [
      "Importing doesn't send invitations, charge payments, or make anything public.",
      "You're in control of what happens next.",
    ] as const,
    shotALabel: "BRING IT OVER",
    shotAAlt:
      "Bring your business with you — choose import from another system, spreadsheets or documents, or start fresh",
    shotBLabel: "PICK UP WHERE YOU LEFT OFF",
    shotBAlt:
      "Willow Grove event workspace for Olivia & James Hayes with planning tools and celebration details connected",
  },
  makeItYours: {
    eyebrow: "MAKE IT YOURS",
    headline: "A few thoughtful questions. A workspace that feels like you.",
    body: "Tell us about your venue, your spaces, how you book celebrations, and how you like to work. Hello to Cheers uses those choices to help shape your everyday experience — from booking workflows to the resources your clients will eventually see.",
    secondary: "You're never starting from scratch.",
    secondaryBody:
      "We've prepared helpful starters for the work venues do every day — from planning tasks and timelines to questionnaires, templates, and more. Make them your own, use what fits, and discover possibilities you may not have had before.",
    closing:
      "Set your preferences once, adjust them whenever you need, and personalize individual celebrations without changing how everything else works.",
    setupAlt:
      "Setup Hub showing four milestones: Protect your calendar, Make HTC yours, Bring your business over, and Take a look then go live",
  },
  practiceRun: {
    eyebrow: "TAKE IT FOR A SPIN",
    headline: "See it all. Try it all. Then go live.",
    body: "Before you welcome your first client, explore Hello to Cheers with a sample celebration. Walk through the venue experience, prepare planning resources, switch into the beautifully branded client portal, and see how everything comes together.",
    secondary:
      "Try the tools, complete a task, send messages between perspectives, and discover exactly what your clients will experience — all safely within Practice Run.",
    emphasis: "You'll be excited to send that first invitation.",
    reassurance:
      "Practice Run stays separate from your real bookings, reporting, and client communications.",
    venueLabel: "YOUR VENUE VIEW",
    venueAlt:
      "Practice Run planning collaboration for Maya & Jordan with Prepare, Share, Explore as Client, and Review steps",
    clientLabel: "THEIR CLIENT EXPERIENCE",
    clientAlt:
      "Maya & Jordan Practice Run client portal Home with their engagement portrait, Willow Grove branding, venue hero, and planning navigation",
  },
  closing: {
    eyebrow: "READY WHEN YOU ARE",
    headline: "Your next chapter starts here.",
    body: [
      "Bring what you've built. Make it your own. See what's possible.",
      "We'll help you feel right at home in Hello to Cheers.",
    ] as const,
    primaryCta: { href: "/pricing", label: "Get Started" },
    secondaryCta: { href: "/walkthrough", label: "Schedule a Walkthrough" },
    noteBefore: "Prefer a helping hand? Ask us about ",
    noteLinkLabel: "White Glove onboarding",
    noteHref: "/contact",
    noteAfter: ".",
  },
} as const;
