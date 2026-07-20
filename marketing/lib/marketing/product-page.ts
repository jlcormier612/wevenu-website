/**
 * Product page copy — definitive “how Hello to Cheers works” experience.
 * Journey depth lives on /product/journey/[slug].
 */

export { PRODUCT_JOURNEY, type ProductJourneyId } from "@/lib/marketing/journey";

export const PRODUCT_PAGE = {
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
      "Every venue is different.",
      "That's why every walkthrough begins with your process—not ours.",
      "We'll show you exactly how Hello to Cheers would support the way your team already works.",
    ],
    button: "Schedule a Walkthrough",
  },
} as const;
