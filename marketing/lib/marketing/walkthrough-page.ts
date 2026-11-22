/**
 * Schedule a Walkthrough — approved editorial page + unified HTC intake.
 * Intake fields match Contact; Calendly opens only after durable CRM save.
 */

export const WALKTHROUGH_PAGE = {
  intro: {
    eyebrow: "A CLOSER LOOK",
    headline: "Let's talk about your venue.",
    body: "Every venue has its own way of doing things. We'd love to learn about yours, show you around Hello to Cheers, and explore how everything could come together in one thoughtfully connected platform.",
    closing: "A personal conversation, tailored to you.",
    imageSrc: "/marketing/walkthrough-personal-conversation.jpg",
    imageAlt:
      "Venue professional discussing event plans during a personalized video walkthrough.",
  },
  intake: {
    headline: "Tell us a little about your venue.",
    body: "Share a few details first — then choose a time that works for you.",
    messagePlaceholder: "Tell us a little about your venue",
    submitLabel: "Continue to scheduling",
  },
  booking: {
    headline: "Find a time that works for you.",
    body: "Choose a convenient time below, and we'll take care of the rest.",
    afterIntake:
      "Thanks — we've saved your details. Pick a time below to finish scheduling your walkthrough.",
  },
  bookingUnavailable: {
    headline: "Scheduling is almost ready.",
    body: "We're finishing the calendar setup for walkthroughs. In the meantime, send us a note and we'll follow up personally.",
    cta: { href: "/contact", label: "Get in Touch" },
  },
  contactAlternative: {
    headline: "Have a question first?",
    body: "Not quite ready for a walkthrough? We'd be happy to hear from you.",
    cta: { href: "/contact", label: "Get in Touch" },
  },
} as const;
