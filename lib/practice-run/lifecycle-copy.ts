/** Customer-facing Practice Run finish / reset copy (safe for client components). */

export const PRACTICE_RESET_CONFIRM_COPY = {
  title: "Start over with a fresh Practice Run?",
  body:
    "This clears Maya & Jordan’s sample progress — messages, practice planning resources, and guided steps — then creates a new sample celebration. Your real venue settings, templates, branding, and clients stay exactly as they are.",
  confirm: "Yes, start over",
  cancel: "Keep exploring",
} as const;

export const PRACTICE_FINISH_COPY = {
  title: "Nice work — you can picture how this feels for your couples.",
  body:
    "Return to Setup whenever you’re ready. Your Practice Run stays here if you want to explore again — nothing was sent, charged, or added to your live business.",
  primary: "Return to Setup",
  secondary: "Keep exploring",
} as const;
