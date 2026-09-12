/**
 * Shared onboarding intake types — Self-Setup and White Glove.
 * Customer-facing choices match the Setup & White Glove product specification.
 */

export type SpaceMode = "one" | "multiple";

export type IntakeSpace = {
  name: string;
  maxCapacity: number | null;
};

export type TastingAppointmentChoice =
  | "tastings"
  | "other_appointments"
  | "both"
  | "neither";

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

export const INQUIRY_SOURCE_OPTIONS: {
  key: InquirySourceKey;
  label: string;
}[] = [
  { key: "website", label: "Website" },
  { key: "email_phone", label: "Email / phone" },
  { key: "facebook_instagram", label: "Facebook / Instagram" },
  {
    key: "marketplace",
    label: "The Knot / WeddingWire / Here Comes the Guide / Zola",
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
      "We'll recognize the HoneyBook export and guide you through bringing your information into Hello to Cheers.",
  },
  {
    key: "tripleseat",
    title: "Yes — I use Tripleseat",
    description:
      "We'll recognize the Tripleseat export and guide you through bringing your information into Hello to Cheers.",
  },
  {
    key: "another_system",
    title: "Yes — I use another system",
    description:
      "No problem. We'll guide you through exporting, mapping, and reviewing your information.",
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
  tastingAppointmentChoice: TastingAppointmentChoice;
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
