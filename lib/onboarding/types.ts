/**
 * Shared onboarding intake types — Self-Setup and White Glove.
 * Customer-facing choices match the Setup & White Glove product specification.
 */

import type { SpaceOperatingMode } from "@/lib/venue-spaces/uses";

export type SpaceMode = "one" | "multiple";

/** Maps intake spaceMode onto venues.space_operating_mode. */
export function spaceOperatingModeFromIntake(mode: SpaceMode): SpaceOperatingMode {
  return mode === "multiple" ? "multi" : "single";
}

export type IntakeSpace = {
  name: string;
  maxCapacity: number | null;
};

export type InquirySourceKey =
  | "website"
  | "email_phone"
  | "facebook_instagram"
  | "marketplace"
  | "other";

export type BringBusinessChoice =
  | "honeybook"
  | "tripleseat"
  | "another_system"
  | "starting_fresh";

/** Appointment kinds offered besides tours — intake + Settings share these keys. */
export type AppointmentTypeKey =
  | "consultations"
  | "planning_meetings"
  | "final_walkthroughs"
  | "menu_tastings"
  | "other";

export const APPOINTMENT_TYPE_OPTIONS: {
  key: AppointmentTypeKey;
  label: string;
}[] = [
  { key: "consultations", label: "Consultations" },
  { key: "planning_meetings", label: "Planning meetings" },
  { key: "final_walkthroughs", label: "Final walkthroughs" },
  { key: "menu_tastings", label: "Menu or food tastings" },
  { key: "other", label: "Other appointments" },
];

export const APPOINTMENT_TYPE_KEY_SET = new Set<string>(
  APPOINTMENT_TYPE_OPTIONS.map((o) => o.key),
);

export function sanitizeAppointmentTypeKeys(
  keys: readonly string[] | null | undefined,
): AppointmentTypeKey[] {
  if (!keys?.length) return [];
  const out: AppointmentTypeKey[] = [];
  for (const raw of keys) {
    if (APPOINTMENT_TYPE_KEY_SET.has(raw) && !out.includes(raw as AppointmentTypeKey)) {
      out.push(raw as AppointmentTypeKey);
    }
  }
  return out;
}

export const INQUIRY_SOURCE_OPTIONS: {
  key: InquirySourceKey;
  label: string;
}[] = [
  { key: "website", label: "Website" },
  { key: "email_phone", label: "Email / phone" },
  { key: "facebook_instagram", label: "Facebook / Instagram" },
  {
    key: "marketplace",
    label: "The Knot / WeddingWire / Here Comes the Guide",
  },
  { key: "other", label: "Other" },
];

export const BRING_BUSINESS_OPTIONS: {
  key: BringBusinessChoice;
  title: string;
  description: string;
}[] = [
  {
    key: "honeybook",
    title: "Yes — I use HoneyBook",
    description:
      "We'll note HoneyBook so our team can guide you through a supported export and review — nothing imports automatically from this answer alone.",
  },
  {
    key: "tripleseat",
    title: "Yes — I use Tripleseat",
    description:
      "We'll note Tripleseat so our team can guide you through a supported export and review — nothing imports automatically from this answer alone.",
  },
  {
    key: "another_system",
    title: "Yes — I use another system",
    description:
      "We'll note that you're coming from another system and guide you through exporting and reviewing what you want to bring over.",
  },
  {
    key: "starting_fresh",
    title: "No — I'm starting fresh",
    description: "We'll set you up with everything you need to get started.",
  },
];

export type OnboardingIntakeInput = {
  venueName: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
  country?: string | null;
  primaryContactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  spaceMode: SpaceMode;
  spaces: IntakeSpace[];
  offersTours: boolean;
  /**
   * Optional operator signal. Null means unanswered.
   * True does not configure appointment scheduling.
   * UI copy: "Do you offer appointments other than tours?"
   */
  offersTastingsOrAppointments: boolean | null;
  /** Selected when offersTastingsOrAppointments is true. Empty when No/unanswered. */
  appointmentTypeKeys?: AppointmentTypeKey[];
  /** Free text when appointmentTypeKeys includes "other". */
  appointmentTypesOther?: string | null;
  inquirySources: InquirySourceKey[];
  inquirySourcesOther?: string | null;
  bringBusinessChoice: BringBusinessChoice;
  /** Self-Setup start-fresh acknowledgement */
  acceptStarters?: boolean;
};

export type OnboardingIntakeRecord = OnboardingIntakeInput & {
  id: string;
  venueId: string;
  enrollmentId: string | null;
  path: "self_setup" | "white_glove";
  startersAcceptedAt: string | null;
  submittedAt: string | null;
};

export function bringBusinessMigrationHref(
  choice: BringBusinessChoice,
): string | null {
  if (choice === "starting_fresh") return null;
  if (choice === "honeybook") return "/settings/migration?source=honeybook";
  if (choice === "tripleseat") return "/settings/migration?source=tripleseat";
  return "/settings/migration?source=another_system";
}

/** Hub acknowledgement of the intake Bring Business answer — not a new source of truth. */
export function bringBusinessIntakeHeading(
  choice: BringBusinessChoice | null | undefined,
): string | null {
  if (choice === "honeybook") return "Bring your HoneyBook business into Hello to Cheers";
  if (choice === "tripleseat") return "Bring your Tripleseat business into Hello to Cheers";
  if (choice === "another_system") return "Bring your existing business into Hello to Cheers";
  if (choice === "starting_fresh") return "Start fresh";
  return null;
}
