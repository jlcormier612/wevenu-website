/**
 * Contact page — approved editorial introduction + personal closing.
 * Form fields and submission behavior remain on the shared LeadForm path.
 */

export const CONTACT_PAGE = {
  intro: {
    eyebrow: "LET'S CONNECT",
    headline: "We'd love to hear from you.",
    body: "Have a question about Hello to Cheers? Tell us a little about your venue and what's on your mind. We're happy to help.",
  },
  form: {
    messagePlaceholder: "How can we help?",
    submitLabel: "Send Message",
  },
  closing: {
    line: "We look forward to connecting.",
  },
} as const;
