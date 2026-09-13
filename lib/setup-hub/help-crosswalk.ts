/**
 * Setup ↔ Help crosswalk — source of truth for Setup Hub destinations and
 * optional Help links. Setup answers “what should I do?”; Help answers “how?”.
 *
 * Rules:
 * - Destinations are real product routes (canonical Settings / Library paths).
 * - Help links are published final Help & Guides articles only — never Setup Guides.
 * - Help is never a completion gate.
 * - Do not invent article titles or alternate product names.
 */
import { FINAL_HELP_ARTICLES } from "@/lib/help-guides/final-articles";

export type SetupStageKey =
  | "your-venue"
  | "calendar-availability"
  | "bring-your-business"
  | "your-offerings"
  | "client-experience"
  | "lead-capture"
  | "your-team"
  | "financials";

export type SetupHelpCrosswalkRow = {
  stage: SetupStageKey;
  title: string;
  /** Canonical in-product destination for the decision/action. */
  destinationHref: string;
  destinationLabel: string;
  /** Customer-facing path wording (matches Help terminology). */
  destinationPathLabel: string;
  /** Published Help article slug, or null when no article should be linked. */
  helpSlug: string | null;
  helpTitle: string | null;
  /** Whether this stage must be addressed before feeling “set up” (not graduation). */
  required: boolean;
  canBeNotApplicable: boolean;
  /** How Setup decides “addressed” — documentation for tests and future work. */
  completionSignal: string;
};

const publishedSlugs = new Set(FINAL_HELP_ARTICLES.map((a) => a.slug));

function help(slug: string): { helpSlug: string; helpTitle: string } {
  const article = FINAL_HELP_ARTICLES.find((a) => a.slug === slug);
  if (!article || !publishedSlugs.has(slug)) {
    throw new Error(`Setup crosswalk references unpublished Help slug: ${slug}`);
  }
  return { helpSlug: article.slug, helpTitle: article.title };
}

export const SETUP_HELP_CROSSWALK: readonly SetupHelpCrosswalkRow[] = [
  {
    stage: "your-venue",
    title: "Your Venue",
    destinationHref: "/settings/business",
    destinationLabel: "Open venue settings",
    destinationPathLabel: "Your Venue → Settings → Business & Brand",
    ...help("where-do-my-venue-colors-actually-show-up"),
    required: true,
    canBeNotApplicable: false,
    completionSignal: "Deliberate review (your_venue_reviewed_at), after visiting Business & Brand (name, contact, hours, logo, hero, colors).",
  },
  {
    stage: "calendar-availability",
    title: "Calendar & Availability",
    destinationHref: "/settings/availability",
    destinationLabel: "Open Availability & Capacity",
    destinationPathLabel: "Your Venue → Settings → Availability & Capacity",
    ...help("how-do-i-set-my-tour-availability"),
    required: true,
    canBeNotApplicable: true, // tours may be Not offered; spaces/capacity still apply
    completionSignal: "Deliberate review (calendar_availability_reviewed_at). Tours off = Not offered, not incomplete.",
  },
  {
    stage: "bring-your-business",
    title: "Bring Your Business",
    destinationHref: "/settings/migration",
    destinationLabel: "Open Migration Center",
    destinationPathLabel: "Your Venue → Settings → Migration Center",
    helpSlug: null,
    helpTitle: null,
    required: true,
    canBeNotApplicable: false,
    completionSignal: "imported (import_batches) | individual (path) | skipped (path). Unaddressed until one is chosen.",
  },
  {
    stage: "your-offerings",
    title: "Your Offerings",
    destinationHref: "/library/packages",
    destinationLabel: "Open Packages",
    destinationPathLabel: "Library → Packages",
    ...help("whats-the-difference-between-a-package-inventory-and-an-inventory-template"),
    required: true,
    canBeNotApplicable: false,
    completionSignal: "Venue-authored packages/inventory (source_master_key IS NULL) OR deliberate review of starters.",
  },
  {
    stage: "client-experience",
    title: "Your Client Experience",
    destinationHref: "/library",
    destinationLabel: "Open Library",
    destinationPathLabel: "Library",
    ...help("what-is-a-questionnaire-template"),
    required: true,
    canBeNotApplicable: false,
    completionSignal: "Venue-authored templates (source_master_key IS NULL) OR deliberate review of starters.",
  },
  {
    stage: "lead-capture",
    title: "Get Your Leads Coming In",
    destinationHref: "/setup-hub/lead-capture",
    destinationLabel: "Set up lead intake",
    destinationPathLabel: "Setup → Get Your Leads Coming In",
    ...help("whats-the-difference-between-a-lead-and-a-client"),
    required: true,
    canBeNotApplicable: false,
    completionSignal: "Configured+verified automated channel OR explicit manual/external path — never embed_key alone.",
  },
  {
    stage: "your-team",
    title: "Your People",
    destinationHref: "/settings/team",
    destinationLabel: "Open Team",
    destinationPathLabel: "Your Venue → Settings → Team & Data",
    helpSlug: null,
    helpTitle: null,
    required: false,
    canBeNotApplicable: true, // solo venue
    completionSignal: "Active non-owner team member OR solo confirmation. Optional — solo is complete.",
  },
  {
    stage: "financials",
    title: "Online payments",
    destinationHref: "/settings/integrations",
    destinationLabel: "Open Financials & Integrations",
    destinationPathLabel: "Your Venue → Settings → Financials & Integrations",
    ...help("can-couples-pay-online"),
    required: false,
    canBeNotApplicable: true,
    completionSignal: "Optional. Stripe connected and/or deliberate “I'll do this later” review.",
  },
];

export function crosswalkRow(stage: SetupStageKey): SetupHelpCrosswalkRow {
  const row = SETUP_HELP_CROSSWALK.find((r) => r.stage === stage);
  if (!row) throw new Error(`Missing Setup crosswalk row: ${stage}`);
  return row;
}

/** Legacy Setup Guide slugs → published Help article (for redirects only). */
export const LEGACY_SETUP_GUIDE_REDIRECTS: Record<string, string> = {
  "setup-your-venue": "where-do-my-venue-colors-actually-show-up",
  "setup-calendar-availability": "how-do-i-set-my-tour-availability",
  "setup-bring-your-business": "what-should-i-set-up-before-i-start",
  "setup-your-offerings": "whats-the-difference-between-a-package-inventory-and-an-inventory-template",
  "setup-client-experience": "what-is-a-questionnaire-template",
  "setup-lead-capture": "whats-the-difference-between-a-lead-and-a-client",
  "setup-your-team": "what-should-i-set-up-before-i-start",
  "setup-financials": "can-couples-pay-online",
  "setup-communication": "whats-the-difference-between-a-lead-and-a-client",
  "understanding-your-calendar": "how-do-i-set-my-tour-availability",
};
