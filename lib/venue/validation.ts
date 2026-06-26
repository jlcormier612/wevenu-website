/**
 * Venue Setup business logic: validation rules.
 *
 * Pure functions, no side effects, no framework/database imports. Run on the
 * client for per-step gating AND authoritatively on the server before any
 * write. Keeping the rules here (not in components or SQL) is the single source
 * of truth for "what makes a valid venue".
 */
import { TIME_ZONES, VENUE_TYPES } from "@/lib/venue/constants";
import type { VenueSetupErrors, VenueSetupInput } from "@/lib/venue/types";

// ---- primitive validators ---------------------------------------------------

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return Boolean(url.hostname) && url.hostname.includes(".");
  } catch {
    return false;
  }
}

export function isValidHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{6})$/.test(value.trim());
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

// ---- wizard step model ------------------------------------------------------

export const SETUP_STEPS = [
  "venue-info",
  "venue-details",
  "business-hours",
  "brand",
  "owner",
  "payments",
  "review",
] as const;

export type SetupStepId = (typeof SETUP_STEPS)[number];

/** Which fields each step is responsible for (drives per-step validation). */
export const STEP_FIELDS: Record<SetupStepId, string[]> = {
  "venue-info": [
    "name",
    "businessName",
    "email",
    "phone",
    "website",
    "addressLine1",
    "addressLine2",
    "city",
    "stateRegion",
    "postalCode",
    "country",
  ],
  "venue-details": ["venueType", "capacity", "timezone"],
  "business-hours": ["businessHours"],
  brand: ["primaryColor", "secondaryColor"],
  owner: ["ownerFullName", "ownerEmail", "ownerTitle", "currency", "weekStartsOn"],
  payments: [],
  review: [],
};

// ---- field rules ------------------------------------------------------------

/**
 * Validate every field and return a flat map of errors. Business-hours errors
 * are keyed as `hours.<dayOfWeek>`.
 */
export function validateVenueSetup(input: VenueSetupInput): VenueSetupErrors {
  const errors: VenueSetupErrors = {};

  // Venue information
  if (!input.name.trim()) {
    errors.name = "Venue name is required.";
  } else if (input.name.trim().length < 2) {
    errors.name = "Venue name is too short.";
  }
  if (input.email.trim() && !isValidEmail(input.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (input.website.trim() && !isValidUrl(input.website)) {
    errors.website = "Enter a valid website URL.";
  }

  // Venue profile
  if (input.venueType && !VENUE_TYPES.some((t) => t.value === input.venueType)) {
    errors.venueType = "Choose a venue type from the list.";
  }
  if (input.capacity.trim()) {
    const n = Number(input.capacity);
    if (!Number.isInteger(n) || n < 0) {
      errors.capacity = "Capacity must be a whole number.";
    } else if (n > 1_000_000) {
      errors.capacity = "That capacity looks too large.";
    }
  }
  if (!input.timezone.trim()) {
    errors.timezone = "Select a time zone.";
  } else if (!TIME_ZONES.some((t) => t.value === input.timezone)) {
    errors.timezone = "Choose a time zone from the list.";
  }

  // Business hours
  for (const h of input.businessHours) {
    if (!h.isOpen) continue;
    if (!isValidTime(h.openTime) || !isValidTime(h.closeTime)) {
      errors[`hours.${h.dayOfWeek}`] = "Set both open and close times.";
    } else if (h.openTime >= h.closeTime) {
      errors[`hours.${h.dayOfWeek}`] = "Closing time must be after opening time.";
    }
  }

  // Brand
  if (!isValidHexColor(input.primaryColor)) {
    errors.primaryColor = "Use a 6-digit hex color (e.g. #5D6F5D).";
  }
  if (!isValidHexColor(input.secondaryColor)) {
    errors.secondaryColor = "Use a 6-digit hex color (e.g. #4F5F4F).";
  }

  // Owner + basic settings
  if (!input.ownerFullName.trim()) {
    errors.ownerFullName = "Owner name is required.";
  }
  if (input.ownerEmail.trim() && !isValidEmail(input.ownerEmail)) {
    errors.ownerEmail = "Enter a valid email address.";
  }

  return errors;
}

/** Validate only the fields owned by a given step. */
export function validateStep(
  step: SetupStepId,
  input: VenueSetupInput,
): VenueSetupErrors {
  const all = validateVenueSetup(input);
  const owned = STEP_FIELDS[step];
  const out: VenueSetupErrors = {};
  for (const [key, message] of Object.entries(all)) {
    const base = key.startsWith("hours.") ? "businessHours" : key;
    if (owned.includes(base)) out[key] = message;
  }
  return out;
}

export function isStepValid(step: SetupStepId, input: VenueSetupInput): boolean {
  return Object.keys(validateStep(step, input)).length === 0;
}
