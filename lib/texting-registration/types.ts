/**
 * HTC venue texting registration — product types (not provider objects).
 */

export const TEXTING_SETUP_PATH = "/settings/communications#texting" as const;

export const TEXTING_PHASES = [
  "not_started",
  "details_needed",
  "information_saved",
  "under_review",
  "needs_attention",
  "setting_up_number",
  "ready",
  "paused",
  "failed",
] as const;

export type TextingPhase = (typeof TEXTING_PHASES)[number];

/** Phases venues may write via authenticated session (not provider-authoritative). */
export const VENUE_WRITABLE_TEXTING_PHASES = [
  "not_started",
  "details_needed",
  "information_saved",
  "under_review",
] as const;

/** Phases only service_role / Track B sync may set (except venue leaving attention/failed). */
export const PROVIDER_AUTHORITATIVE_TEXTING_PHASES = [
  "needs_attention",
  "setting_up_number",
  "ready",
  "paused",
  "failed",
] as const;

/** Venue-facing status labels for the status panel (never provider enums). */
export type TextingPanelTone =
  | "ready"
  | "confirmed"
  | "pending"
  | "needs_attention"
  | "not_ready"
  | "paused";

export type TextingStatusPanel = {
  businessInformation: { label: string; tone: TextingPanelTone };
  messagingRegistration: { label: string; tone: TextingPanelTone };
  textingNumber: { label: string; tone: TextingPanelTone; e164: string | null };
  texting: { label: string; tone: TextingPanelTone };
  attention: {
    code: string | null;
    message: string | null;
    fixHint: string | null;
  } | null;
  phase: TextingPhase;
  canResubmit: boolean;
  smsReady: boolean;
};

export type BusinessType =
  | "sole_proprietorship"
  | "partnership"
  | "llc"
  | "corporation"
  | "nonprofit"
  | "co_operative"
  | "other";

export type JobPosition =
  | "director"
  | "gm"
  | "vp"
  | "ceo"
  | "cfo"
  | "general_counsel"
  | "other";

/** Fields a venue can edit during onboarding (no ciphertext, no support_debug). */
export type TextingRegistrationInput = {
  businessName: string;
  websiteUrl: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  contactEmail: string;
  contactPhone: string;
  businessType: string;
  businessIndustry: string;
  registrationIdType: string;
  /** Plain EIN/registration number — encrypted before persistence. Empty keeps existing. */
  registrationNumber: string;
  regionsOfOperation: string;
  repFirstName: string;
  repLastName: string;
  repEmail: string;
  repPhone: string;
  repBusinessTitle: string;
  repJobPosition: string;
  messagingPurpose: string;
  sampleMessage1: string;
  sampleMessage2: string;
  optInDescription: string;
  privacyPolicyUrl: string;
  termsUrl: string;
};

/** Safe for client components — never includes full registration number or support_debug. */
export type TextingRegistrationView = {
  venueId: string;
  phase: TextingPhase;
  attentionCode: string | null;
  attentionMessage: string | null;
  attentionFixHint: string | null;
  businessName: string | null;
  websiteUrl: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  country: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  businessConfirmedAt: string | null;
  businessType: string | null;
  businessIndustry: string | null;
  registrationIdType: string | null;
  hasRegistrationNumber: boolean;
  registrationNumberLast4: string | null;
  regionsOfOperation: string | null;
  repFirstName: string | null;
  repLastName: string | null;
  repEmail: string | null;
  repPhone: string | null;
  repBusinessTitle: string | null;
  repJobPosition: string | null;
  messagingPurpose: string | null;
  sampleMessage1: string | null;
  sampleMessage2: string | null;
  optInDescription: string | null;
  privacyPolicyUrl: string | null;
  termsUrl: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TextingSetupWizardStep =
  | "intro"
  | "confirm_business"
  | "additional_details"
  | "review"
  | "status";

export const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string }[] = [
  { value: "llc", label: "LLC" },
  { value: "corporation", label: "Corporation" },
  { value: "sole_proprietorship", label: "Sole proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "co_operative", label: "Co-operative" },
  { value: "other", label: "Other" },
];

export const JOB_POSITION_OPTIONS: { value: JobPosition; label: string }[] = [
  { value: "ceo", label: "Owner / CEO" },
  { value: "director", label: "Director" },
  { value: "gm", label: "General manager" },
  { value: "vp", label: "VP" },
  { value: "cfo", label: "CFO" },
  { value: "general_counsel", label: "General counsel" },
  { value: "other", label: "Other" },
];

export const INDUSTRY_OPTIONS: { value: string; label: string }[] = [
  { value: "HOSPITALITY", label: "Hospitality / venues" },
  { value: "ENTERTAINMENT", label: "Entertainment / events" },
  { value: "PROFESSIONAL", label: "Professional services" },
  { value: "RETAIL", label: "Retail" },
  { value: "OTHER", label: "Other" },
];

export const REGISTRATION_ID_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "EIN", label: "EIN (US employer ID)" },
  { value: "CBN", label: "Canadian Business Number" },
  { value: "Other", label: "Other registration ID" },
];

export const REGION_OPTIONS: { value: string; label: string }[] = [
  { value: "USA_AND_CANADA", label: "United States and Canada" },
  { value: "EUROPE", label: "Europe" },
  { value: "ASIA", label: "Asia" },
  { value: "LATIN_AMERICA", label: "Latin America" },
  { value: "AUSTRALIA", label: "Australia" },
  { value: "AFRICA", label: "Africa" },
];

/** Customer-safe copy when HTC has details and ops/setup is not yet send-ready. */
export const INFORMATION_SAVED_STATUS_COPY =
  "Your information is saved. Hello to Cheers is setting up texting for your venue. We’ll let you know when it’s ready.";

/** Customer-safe copy when ops has a venue Twilio account still pending compliance / setup. */
export const TEXTING_SETUP_IN_PROGRESS_COPY =
  "Texting setup is in progress for your venue. We’ll assign your texting number when it’s ready.";
