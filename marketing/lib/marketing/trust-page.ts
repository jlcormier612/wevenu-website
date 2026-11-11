/**
 * Trust experience — approved five-section editorial page.
 * Copy is locked to the final creative specification.
 */

export const TRUST_PAGE = {
  hero: {
    eyebrow: "OUR PROMISE",
    /** Full phrase — locked; rendered as deliberate editorial lines. */
    headline: "Trust is earned. Every day.",
    headlineLines: [
      { text: "Trust is earned.", emphasis: false },
      { text: "Every day.", emphasis: true },
    ] as const,
    body: "Your clients trust you with life's most meaningful celebrations. You should feel just as confident about the platform you trust with your business.",
    closing:
      "Our promise is simple: respect your relationships, protect your information, and give you control.",
    imageAlt:
      "Trust — Earned every month. Kept for every celebration. Stationery photograph",
  },
  dataOwnership: {
    eyebrow: "YOUR INFORMATION",
    /** Full phrase — locked; rendered as deliberate editorial lines. */
    headline: "Your business. Your relationships. Your data.",
    headlineLines: [
      { text: "Your business.", emphasis: false },
      { text: "Your relationships.", emphasis: false },
      { text: "Your data.", emphasis: true },
    ] as const,
    paragraphs: [
      "The information you build and manage in Hello to Cheers belongs to your business—not to us.",
      "And if you ever decide to leave, you can export your core business records and documents directly from your account. No unnecessary hoops.",
    ],
  },
  security: {
    eyebrow: "BUILT WITH CARE",
    headline: "Thoughtful protection, built in.",
    intro:
      "Security shouldn't be something you have to think about every day. It's something we work to maintain behind the scenes.",
    commitments: [
      {
        title: "Protected information",
        body: "Modern encryption practices help safeguard information in transit and in storage.",
      },
      {
        title: "The right access",
        body: "Roles and permissions help you control who on your team can access your business information.",
      },
      {
        title: "Backups and recovery",
        body: "Backup and recovery practices help protect the information your business depends on.",
      },
      {
        title: "Ongoing attention",
        body: "We monitor our systems and continually improve the reliability and security of the platform.",
      },
    ],
  },
  privacy: {
    eyebrow: "RESPECTING YOUR TRUST",
    headline: "Your information deserves respect.",
    body: "We don't sell your business or client data. We use information to operate, support, secure, and improve Hello to Cheers, as explained in our Privacy Policy.",
    cta: { href: "/privacy", label: "Read our Privacy Policy →" },
  },
  close: {
    headline: "A partnership built on trust.",
    body: "We're here to help you care for every celebration—and the business behind it.",
    primaryCta: { href: "/walkthrough", label: "Schedule a Walkthrough" },
  },
} as const;
