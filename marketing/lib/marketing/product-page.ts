/**
 * Product page copy — definitive “how Hello to Cheers works” experience.
 * Seven-chapter Product Journey: product-story.ts
 * Deep magazine depth: /product/journey/[slug] via journey.ts (preserved).
 *
 * Sections 1–2 opening copy is approved and must not be altered here.
 */

export { PRODUCT_JOURNEY, type ProductJourneyId } from "@/lib/marketing/journey";
export { PRODUCT_STORY, type ProductStoryId } from "@/lib/marketing/product-story";

/** Public marketing assets for Product Sections 1–2 (Stage B marketing-safe). */
export const PRODUCT_OPENING_ASSETS = {
  venueDashboardDesktop: "/marketing/product-s12/venue-dashboard-desktop.png",
  venueDashboardMobile: "/marketing/product-s12/venue-dashboard-mobile.png",
  /** Exact couple Home hero (user-provided). */
  clientHomeHero: "/marketing/product-s12/client-home-hero.png",
  /** Exact couple Home: six planning cards, tightly cropped (no empty below). */
  clientPlanningCards: "/marketing/product-s12/client-planning-cards-tight.png",
  /** Retained asset; not used in the two-shot client composition. */
  clientVenueCollaboration: "/marketing/product-s12/client-venue-collaboration.png",
  vendorFloraHome: "/marketing/product-s12/vendor-flora-home.png",
  /** Exact vendor Home + open notifications (Olivia & James selected). */
  vendorFloraHomeWithNotification:
    "/marketing/product-s12/vendor-flora-home-with-notification-exact.png",
  vendorSelectedNotification: "/marketing/product-s12/vendor-selected-notification.png",
  /** Exact Olivia & James Hayes Overview — content-tight crop for secondary frame. */
  vendorHayesOverview: "/marketing/product-s12/vendor-hayes-overview-tight-v2.png",
} as const;

export const PRODUCT_PAGE = {
  /** §1 Venue-first hero */
  openingHero: {
    eyebrow: "THE HELLO TO CHEERS EXPERIENCE",
    headline: "Your venue, beautifully connected.",
    support:
      "One thoughtfully designed platform to run your business, collaborate with clients, and coordinate with vendors—from the first inquiry to the final celebration.",
  },
  /** §2 Connected experiences intro */
  connected: {
    eyebrow: "BEYOND THE VENUE",
    headline: "Everyone has a part to play. Now everyone has a place.",
    support:
      "Hello to Cheers connects your venue, your clients, and your vendors through dedicated workspaces designed around what each person needs to do. Less chasing information. More working together.",
  },
  clientShowcase: {
    eyebrow: "FOR YOUR CLIENTS",
    headline: "Planning their celebration, their way.",
    body: "Give your clients a space to make their celebration truly their own. From wedding websites and guest lists to budgets, seating, vendors, and personal planning, they have the freedom to bring their vision to life. And with everything connected to your venue, you spend less time answering questions, tracking down details, and managing the back-and-forth.",
  },
  vendorShowcase: {
    eyebrow: "FOR YOUR VENDORS",
    headline: "More opportunities. Stronger partnerships. Less chasing.",
    body: "Give vendors a reason to stay connected. They can showcase their services, receive new inquiries, grow their business, and manage their events—all from their own workspace. With event details, timelines, tasks, and communication in one place, everyone stays informed and accountable, without your team having to chase down updates or coordinate every moving part.",
  },
  /** Legacy hero fields retained for any remaining references; opening uses openingHero. */
  hero: {
    eyebrow: "Product",
    chapterTitle: "Follow One Celebration",
    headline: "The Entire Venue.\nConnected.",
    body: "One calm workspace where sales, planning, communication, operations, finances, and guest experience live together.",
    bodySecondary:
      "Built around how independent venues actually work—not around disconnected software.",
    primaryCta: "Schedule a Walkthrough",
    secondaryCta: "Follow One Booking",
  },
  journey: {
    headline: "One celebration. A thousand details. All coming together.",
    support:
      "Follow a celebration from the first hello to the final cheers—and discover what changes when everything works together.",
  },
  cta: {
    headline: "Imagine your venue inside it.",
    lines: [
      "Every venue is different.",
      "That's why every walkthrough begins with your process—not ours.",
      "We'll show you exactly how Hello to Cheers would support the way your team already works.",
    ],
    button: "Schedule a Walkthrough",
  },
} as const;
