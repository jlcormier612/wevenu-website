/**
 * Venue domain types (Sprint 3 — Venue Foundation).
 *
 * Pure types shared across the UI, application services and business logic.
 * No framework or database imports — safe to use on the client or the server.
 */

export type StripeOnboardingStatus = "not_started" | "pending" | "connected";

export type StaffRole = "owner" | "manager" | "staff";

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

  // Brand (per-venue)
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;

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
  primaryColor: string;
  secondaryColor: string;
  currency: string;
  weekStartsOn: number;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  stripeOnboardingStatus: StripeOnboardingStatus;
  setupCompleted: boolean;
  setupCompletedAt: string | null;
  onboardingDismissed: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Field-keyed validation errors (e.g. { name: "Required", "hours.0": "…" }). */
export type VenueSetupErrors = Record<string, string>;
