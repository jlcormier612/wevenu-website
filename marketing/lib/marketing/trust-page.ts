/**
 * Trust experience — editorial home for security, privacy, reliability, and transparency.
 * Philosophy: Trust isn't built by contracts. It's earned by showing up.
 */

export const TRUST_PAGE = {
  hero: {
    title: "Trust",
    headline: "Trust isn't built by contracts.",
    subhead:
      "It's built by showing up, keeping our promises, and earning the privilege to serve you month after month.",
    lines: [
      "Venue owners trust you with life's most meaningful celebrations.",
      "You trust us with your business.",
      "We take that responsibility seriously.",
    ],
  },
  nav: [
    { id: "security", label: "Security" },
    { id: "privacy", label: "Privacy" },
    { id: "data-ownership", label: "Data Ownership" },
    { id: "reliability", label: "Reliability" },
    { id: "compliance", label: "Compliance" },
    { id: "terms", label: "Terms" },
    { id: "subscription", label: "Subscription" },
    { id: "cancellation", label: "Cancel Anytime" },
    { id: "happiness", label: "Happiness Promise" },
  ],
  security: {
    title: "Security",
    headline: "Trust is earned.",
    intro: [
      "Venue owners trust you with some of life's most important celebrations.",
      "You trust us with your business.",
      "We take that responsibility seriously.",
    ],
    points: [
      {
        title: "Encryption",
        body: "Your data is protected in transit and at rest using industry-standard encryption. Sensitive information never travels in the clear.",
      },
      {
        title: "Secure infrastructure",
        body: "Wevenu runs on carefully chosen cloud infrastructure with modern security practices—isolation, hardening, and least-privilege access as a default.",
      },
      {
        title: "Backups",
        body: "We maintain regular backups so that unexpected events don't mean lost celebrations, lost conversations, or lost history.",
      },
      {
        title: "Access controls",
        body: "Team permissions and account access are designed so the right people see the right information—and nothing more.",
      },
      {
        title: "Monitoring",
        body: "We watch for unusual activity and system health continuously, so we can respond quickly when something needs attention.",
      },
      {
        title: "Payments",
        body: "Payment card data is handled by Stripe—a PCI-compliant payment processor. Wevenu is not designed to store raw card numbers on our systems.",
      },
      {
        title: "Ongoing improvement",
        body: "Security isn't a one-time checklist. We keep improving our practices as threats and technology evolve.",
      },
    ],
  },
  privacy: {
    title: "Privacy",
    headline: "In Plain English",
    lines: [
      "We don't sell your data.",
      "We use it only to operate and improve Wevenu.",
      "We'll always be transparent about how your information is used.",
    ],
    cta: { href: "/privacy", label: "Read the full Privacy Policy →" },
  },
  dataOwnership: {
    title: "Data Ownership",
    headline: "Your data belongs to you.",
    subhead: "Not us. Not ever.",
    lines: [
      "If you choose to leave Wevenu, your data should leave with you.",
      "You can export your information before cancellation—without filing a support ticket or navigating unnecessary barriers.",
      "That philosophy isn't a footnote. It shapes how we design the product.",
    ],
  },
  reliability: {
    title: "Reliability",
    headline: "Prepared for the work of real venues.",
    points: [
      {
        title: "Automatic backups",
        body: "We back up your workspace so celebration records, planning history, and conversations have a safety net.",
      },
      {
        title: "High availability",
        body: "We design for steady uptime and resilient infrastructure, recognizing that venues rely on Wevenu during real events—not only quiet mornings.",
      },
      {
        title: "Planned maintenance",
        body: "When maintenance is needed, we aim to communicate clearly and schedule thoughtfully whenever possible.",
      },
      {
        title: "Incident communication",
        body: "If something goes wrong, we believe you deserve honesty, clarity, and updates—not silence.",
      },
      {
        title: "System Status",
        body: "Our System Status page is where we'll share current operational status and notable incidents as Wevenu grows.",
      },
      {
        title: "Continual improvement",
        body: "Reliability is a practice. We keep investing in the quiet work that keeps hospitality software feeling calm.",
      },
    ],
    disclaimer:
      "We work hard to keep Wevenu available and healthy. Like all software, we cannot guarantee uninterrupted service at every moment—and we won't pretend otherwise.",
    statusCta: { href: "/status", label: "View System Status →" },
  },
  compliance: {
    title: "Compliance",
    headline: "Honest about where we are—and where we're going.",
    lines: [
      "We take compliance seriously, and we prefer clarity over buzzwords.",
      "Payment security: card payments are processed by Stripe, which maintains PCI DSS compliance for cardholder data.",
      "Accessibility: we design Wevenu with inclusive usability in mind and continue improving accessibility across the experience.",
      "SOC 2: we are building our security and operational practices with a SOC 2 roadmap in mind. We will only claim a SOC 2 report when one has been completed—not before.",
      "As additional compliance initiatives come into place, we'll update this page with the same honesty we expect from hospitality itself.",
    ],
  },
  terms: {
    title: "Terms",
    headline: "In Plain English",
    lines: [
      "We built Wevenu to earn your business every month—not lock you into it.",
      "Here's what that means.",
      "You can cancel your subscription anytime.",
      "You own your data.",
      "We'll protect your information.",
      "We'll be transparent if something goes wrong.",
      "We'll never intentionally make leaving difficult.",
    ],
    cta: { href: "/terms", label: "Read the full Terms of Service →" },
  },
  subscription: {
    title: "Subscription Philosophy",
    headline: "Simple Pricing. Simple Terms. No Surprises.",
    lines: [
      "We don't believe software should keep customers through contracts.",
      "We believe it should earn the privilege to serve them every month.",
      "Our subscriptions are month-to-month.",
      "No long-term contracts.",
      "No cancellation fees.",
      "No hidden pricing.",
      "No unnecessary friction.",
      "If you're happy, we hope you'll stay.",
      "If we're no longer the right fit, we'll make leaving just as respectful as joining.",
    ],
  },
  cancellation: {
    title: "Cancel Anytime",
    lines: [
      "No contracts.",
      "No cancellation fees.",
      "No phone calls.",
      "No emails asking you to stay.",
      "If Wevenu is no longer the right fit, you can cancel your subscription in just a few clicks.",
      "We'll be grateful for the time we spent working together.",
    ],
  },
  happiness: {
    title: "30-Day Happiness Promise",
    lines: [
      "If Wevenu isn't the right fit during your first 30 days, we'll happily refund your first month's subscription.",
      "After that, your subscription continues month-to-month until you cancel.",
      "No hassle.",
      "No surprises.",
      "We believe great software keeps customers because they love using it—not because they're locked into a contract.",
    ],
  },
  close: {
    lines: [
      "We know trust isn't something you can ask for.",
      "It's something you earn.",
    ],
  },
} as const;
