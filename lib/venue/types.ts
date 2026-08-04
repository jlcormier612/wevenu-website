/**
 * Venue domain types (Sprint 3 — Venue Foundation).
 *
 * Pure types shared across the UI, application services and business logic.
 * No framework or database imports — safe to use on the client or the server.
 */

export type StripeOnboardingStatus = "not_started" | "pending" | "connected";

/** Kept as an allowed-values array, not one flag per method — scales to any future Stripe-supported method without a schema change. */
export type StripePaymentMethodType = "card" | "us_bank_account";

export type StaffRole = "owner" | "manager" | "staff";

/**
 * Captured once, right alongside the venue name — drives which of three
 * scripts Guided Setup and Luv narrate the whole journey with. See
 * docs/hospitality-success-platform-implementation-plan.md §1.2a.
 */
export type OnboardingPersona = "new" | "switching" | "weven_returning";

/** A single day's operating hours as collected by the wizard. */
export type BusinessHourInput = {
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
  isOpen: boolean;
  openTime: string; // "HH:MM" (24h) or ""
  closeTime: string; // "HH:MM" (24h) or ""
};

/**
 * The full Venue Setup form model. The wizard keeps every field as a string
 * (or simple value) for controlled inputs; the service layer normalises and
 * validates before persistence.
 */
export type VenueSetupInput = {
  // Which of three onboarding scripts this venue is on. Null until the
  // Origin micro-step is answered (before "Venue information").
  onboardingPersona: OnboardingPersona | null;

  // Venue information
  name: string;
  businessName: string;
  email: string;
  phone: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;

  // Venue profile
  venueType: string;
  capacity: string; // kept as string in the form, parsed on submit
  timezone: string;

  // Business hours
  businessHours: BusinessHourInput[];

  // Brand (per-venue) — four-color system
  logoUrl: string;
  // Program 4, Initiative D (2026-07-23) — settings-only, like logoUrl;
  // never touched by the onboarding wizard.
  heroImageUrl: string;
  story: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  neutralColor: string;

  // Staff owner + basic settings
  ownerFullName: string;
  ownerEmail: string;
  ownerTitle: string;
  currency: string;
  weekStartsOn: number;

  // Payments (Stripe Connect — placeholder)
  stripeOnboardingStatus: StripeOnboardingStatus;
};

/** A persisted venue, mapped from the database row into camelCase. */
export type Venue = {
  id: string;
  ownerUserId: string;
  name: string;
  businessName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  country: string | null;
  venueType: string | null;
  capacity: number | null;
  timezone: string;
  logoUrl: string | null;
  // Program 4, Initiative D, Phase 2/3/6 (2026-07-23) — the venue's own
  // hero photograph and a short "our story" blurb, shown in the Couple
  // Workspace hero and the Venue Guide (the same image, both places).
  heroImageUrl: string | null;
  story: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  neutralColor: string;
  currency: string;
  weekStartsOn: number;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  stripeChargesEnabledVerifiedAt: string | null;
  stripeOnboardingStatus: StripeOnboardingStatus;
  stripeAcceptedPaymentMethods: StripePaymentMethodType[];
  setupCompleted: boolean;
  setupCompletedAt: string | null;
  /** The furthest Guided Setup wizard step this venue has actually completed — drives where a resumed setup picks back up. */
  setupLastStep: string | null;
  onboardingPersona: OnboardingPersona | null;
  onboardingDismissed: boolean;
  luvIntroSeenAt: string | null;
  embedKey: string;   // public key for the venue's inquiry form — /form/{embedKey}
  leadEmailKey: string;   // Email Intake Engine — leads+{leadEmailKey}@{inbound domain}
  tourSchedulingEnabled: boolean;
  // Program 2 Phase 2B rollout flag — per docs/conversation-experience-cutover.md's
  // staged rollout (dogfood -> opt-in beta -> default-on -> retirement).
  // Gates the new unified Conversation UI; false leaves the venue on the
  // legacy Messages tab / Messaging inbox, untouched.
  conversationExperienceEnabled: boolean;
  // Booking Financial Architecture rollout flag (docs/booking-financial-
  // architecture-roadmap.md's cross-cutting strategy) — same staged-rollout
  // posture as conversationExperienceEnabled above. False leaves a venue's
  // Booking Workspace with no Event Order tab at all; nothing else changes.
  eventOrderEnabled: boolean;
  /** CRM Suspend / unpaid dunning hard-lock. Data is preserved when true. */
  accessDisabled: boolean;
  /** Mirrors accessDisabled today: active | suspended. */
  accountStatus: "active" | "suspended";
  /** Hello to Cheers SaaS Stripe Customer id for Billing Portal (not Connect). */
  saasStripeCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Field-keyed validation errors (e.g. { name: "Required", "hours.0": "…" }). */
export type VenueSetupErrors = Record<string, string>;
