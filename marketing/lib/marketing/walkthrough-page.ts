/**
 * Schedule a Walkthrough — approved three-section editorial page.
 * Copy is locked to the creative specification.
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
  booking: {
    headline: "Find a time that works for you.",
    body: "Choose a convenient time below, and we'll take care of the rest.",
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
