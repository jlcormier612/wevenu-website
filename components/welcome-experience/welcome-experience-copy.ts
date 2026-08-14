/**
 * Optional context copy for future Welcome Experience callers (WP4+).
 * Not used as component defaults — callers must pass heading/introduction.
 */

export const WELCOME_EXPERIENCE_COPY = {
  venueSignup: {
    heading: "Welcome to Hello to Cheers",
    introduction: [
      "You’re joining Hello to Cheers to host events with clarity and care.",
      "Please review the documents below to continue.",
    ],
  },
  coupleInvitation: {
    heading: "Welcome to Hello to Cheers",
    introduction: [
      "Your venue has invited you to collaborate on your event.",
      "Please review the documents below to continue.",
    ],
  },
  vendorInvitation: {
    heading: "Welcome to Hello to Cheers",
    introduction: [
      "You’ve been invited to collaborate on an event.",
      "Please review the documents below to continue.",
    ],
  },
  versionUpdate: {
    heading: "A quick update before you continue",
    introduction:
      "We’ve updated documents that apply to your account. Please review and confirm to continue.",
  },
} as const;
