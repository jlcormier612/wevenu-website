/**
 * Product page copy — definitive “how Wevenu works” experience.
 * Journey depth lives on /product/journey/[slug].
 */

export { PRODUCT_JOURNEY, type ProductJourneyId } from "@/lib/marketing/journey";

export const PRODUCT_PAGE = {
  hero: {
    eyebrow: "Product",
    headline: "The Entire Venue.\nConnected.",
    body: "One calm workspace where sales, planning, communication, operations, finances, and guest experience live together.",
    bodySecondary:
      "Built around how independent venues actually work—not around disconnected software.",
    primaryCta: "Request a Walkthrough",
    secondaryCta: "Follow One Booking",
  },
  journey: {
    eyebrow: "Follow one booking",
    headline: "One celebration. One continuous story.",
    support:
      "Every booking becomes one connected experience—from the first inquiry through the final celebration.",
    exploreHint: "Every chapter below opens into a deeper look at that part of the venue journey.",
  },
  /** Soft editorial chapter groups within the Product journey */
  storyActs: [
    { beforeId: "inquiry", label: "The Story Begins" },
    { beforeId: "contract-inventory", label: "The Relationship Deepens" },
    { beforeId: "timeline", label: "The Celebration Arrives" },
  ] as const,
  cta: {
    headline: "Imagine your venue inside it.",
    lines: [
      "A walkthrough shaped around how your property actually runs.",
      "Not a demo of features—an invitation to see your celebrations, connected.",
    ],
    button: "Request a Walkthrough",
  },
} as const;
