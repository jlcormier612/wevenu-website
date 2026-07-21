/**
 * Our Story — belief chapter. Unique purpose: why any of this matters.
 * Never duplicates Home. Never recreates Product, Features, Pricing, or Trust pages.
 */

export const OUR_STORY = {
  opening: {
    eyebrow: "Our Story",
    chapterTitle: "Hospitality First",
    lines: [
      "We didn't start by asking what software should do.",
      "We started by asking what hospitality deserves.",
      "There is a quiet difference between helping someone manage events...",
      "...and helping someone create unforgettable celebrations.",
      "Technology can organize information.",
      "But hospitality is built on people.",
      "Relationships.",
      "Trust.",
      "Presence.",
      "Care.",
      "Every decision inside Hello to Cheers begins with one question:",
      '"Does this make hospitality feel more human?"',
      "If the answer is no...",
      "we don't build it.",
      "That is what this page is about.",
      "Not features.",
      "Not software.",
      "Belief.",
    ],
  },
  hospitality: {
    eyebrow: "Hospitality Comes First",
    headline: "Hospitality should never feel like administration.",
    lines: [
      "Software exists to give venue owners and teams more time for hospitality.",
      "Not more administration.",
      "Not more complexity.",
      "Technology should disappear.",
      "The venue should remain.",
      "The software shouldn't become the experience.",
      "It should quietly support the people creating it.",
    ],
  },
  promise: {
    eyebrow: "Our Promise",
    headline: "Technology changes.\nHospitality doesn't.",
    lines: [
      "Every product decision inside Hello to Cheers is measured against the same promise.",
      "Will this save time?",
      "Will it reduce stress?",
      "Will it strengthen relationships?",
      "Will it help venues create better experiences?",
      "If it doesn't...",
      "it doesn't belong.",
    ],
  },
  roleOfLuv: {
    eyebrow: "The Role of Luv",
    headline: "Hospitality will always belong to people.",
    lines: [
      "Luv was never intended to replace the people who make your venue special.",
      "She quietly notices what deserves attention, prepares thoughtful suggestions, and helps keep important details from slipping through the cracks.",
      "So your team can spend less time managing software...",
      "and more time practicing hospitality.",
    ],
  },
  pricingPhilosophy: {
    eyebrow: "Our Pricing Philosophy",
    lines: [
      "Software should earn its place every month.",
      "We don't believe in locking customers into contracts.",
      "We don't believe in charging extra for features that make hospitality better.",
      "Every venue receives every feature.",
      "The only thing that changes is the number of celebrations you manage each year.",
      "Simple.",
      "Transparent.",
      "Designed to grow with you.",
    ],
    cta: { href: "/pricing", label: "Explore Pricing →" },
  },
  trust: {
    eyebrow: "Trust",
    headline: "Trust isn't built by contracts.",
    subhead:
      "It's built by showing up, keeping our promises, and earning the privilege to serve you month after month.",
    lines: [
      "Couples and clients trust you with life's most meaningful celebrations.",
      "You trust us with your business.",
      "We take that responsibility seriously.",
      "Hello to Cheers believes trust is earned every month—through transparency, security, privacy, data ownership, and the freedom to cancel anytime.",
    ],
    ideas: [
      "Transparency",
      "Security",
      "Privacy",
      "Data ownership",
      "Cancel anytime",
    ],
    cta: { href: "/trust", label: "Read our full Trust philosophy →" },
  },
  welcome: {
    eyebrow: "An Invitation",
    lines: [
      "We built Hello to Cheers because we believe software should give hospitality back to the people who create it.",
      "If that belief resonates with you, we'd be honored to welcome you.",
    ],
  },
} as const;
