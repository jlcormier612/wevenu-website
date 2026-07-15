/**
 * Locked Product page copy — experience narrative, not a feature inventory.
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
  philosophy: {
    headline: "You were never looking for software.",
    lines: [
      "You were looking for fewer repeated conversations.",
      "One place where all the magic of your venue comes together.",
    ],
  },
  journey: {
    eyebrow: "One booking. One record.",
    headline: "Follow the journey that defines how Wevenu works.",
    support:
      "Every booking becomes one connected experience—from the first inquiry through the final celebration.",
  },
  connected: {
    eyebrow: "Not integrated. Connected.",
    headline: "The entire venue, one living record.",
    continuum: [
      "One inquiry becomes one booking.",
      "One booking becomes one planning experience.",
      "One planning experience becomes one event.",
      "One event becomes one financial record.",
      "One financial record becomes one guest experience.",
      "One guest experience becomes one successful celebration.",
    ],
    footer: [
      "No duplicate entry.",
      "No exporting.",
      "No syncing.",
      "No wondering which system is correct.",
    ],
  },
  workspace: {
    eyebrow: "The Workspace",
    headline: "Calm enough for a workday.\nConnected enough for an entire venue.",
    intro: "Everything your venue needs lives in one thoughtful workspace.",
    lines: [
      "Morning priorities.",
      "Bookings.",
      "Planning.",
      "Conversations.",
      "Financials.",
      "Tasks.",
    ],
    close: "Without switching between systems.",
  },
  luv: {
    eyebrow: "Meet Luv",
    headline: "Hospitality intelligence—not another assistant.",
    body: "Luv exists to help venues scale hospitality without losing heart.",
    lines: [
      "Real recommendations.",
      "Real conversations.",
      "Included with the platform—never bolted on later.",
    ],
  },
  differentiator: {
    eyebrow: "The Differentiator",
    headline: "Venue.\nCouple.\nVendor.",
    support:
      "Most platforms serve one or two.\nWevenu connects all three—from the same living record.",
    parties: [
      {
        name: "Venue",
        line: "The operating system for how your venue actually runs.",
      },
      {
        name: "Couple",
        line: "A planning experience that feels like your property—not another portal.",
      },
      {
        name: "Vendor",
        line: "Clear participation without another siloed inbox.",
      },
    ],
  },
  cta: {
    headline: "See how different feels.",
    lines: [
      "A calm conversation about your venue.",
      "No pressure.",
      "No sales pitch.",
      "Just clarity.",
    ],
    button: "Request a Walkthrough",
  },
} as const;
