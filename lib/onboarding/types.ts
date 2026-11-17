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
    key: "another_system",
    title: "Import from another system",
    description:
      "Upload files you've exported from your current software. We'll help organize and match your information before anything is added.",
  },
  {
    key: "starting_fresh",
    title: "I'm starting fresh",
    description: "Skip importing and start setting up your business in Hello to Cheers.",
  },
];

/** Stored intake keys still accepted; they are not customer-facing source names. */
export const LEGACY_BRING_BUSINESS_KEYS: BringBusinessChoice[] = ["honeybook", "tripleseat"];

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
  return "/setup-hub/bring-your-business?entry=import";
}

/** Hub acknowledgement of the intake Bring Business answer — not a new source of truth. */
export function bringBusinessIntakeHeading(
  choice: BringBusinessChoice | null | undefined,
): string | null {
  if (choice === "honeybook" || choice === "tripleseat" || choice === "another_system") {
    return "Bring your existing business into Hello to Cheers";
  }
  if (choice === "starting_fresh") return "Start fresh";
  return null;
}
