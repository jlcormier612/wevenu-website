/**
 * Venue reference data and sensible defaults (Sprint 3).
 *
 * Pure data — no framework/database imports. Used by both the wizard (client)
 * and the service layer (server).
 */
import type { BusinessHourInput, VenueSetupInput } from "@/lib/venue/types";

export type Option = { value: string; label: string };

/** Venue categories offered during setup. */
export const VENUE_TYPES: Option[] = [
  { value: "wedding_venue", label: "Wedding Venue" },
  { value: "banquet_hall", label: "Banquet Hall" },
  { value: "barn", label: "Barn / Farm" },
  { value: "winery", label: "Winery / Vineyard" },
  { value: "garden_estate", label: "Garden / Estate" },
  { value: "hotel_resort", label: "Hotel / Resort" },
  { value: "restaurant", label: "Restaurant / Private Dining" },
  { value: "brewery", label: "Brewery / Distillery" },
  { value: "country_club", label: "Country Club" },
  { value: "conference_center", label: "Conference Center" },
  { value: "rooftop", label: "Rooftop / Loft" },
  { value: "museum_gallery", label: "Museum / Gallery" },
  { value: "other", label: "Other" },
];

/** Curated IANA time zones (common for North American venues, plus majors). */
export const TIME_ZONES: Option[] = [
  { value: "America/New_York", label: "Eastern Time — New York (ET)" },
  { value: "America/Toronto", label: "Eastern Time — Toronto (ET)" },
  { value: "America/Chicago", label: "Central Time — Chicago (CT)" },
  { value: "America/Winnipeg", label: "Central Time — Winnipeg (CT)" },
  { value: "America/Denver", label: "Mountain Time — Denver (MT)" },
  { value: "America/Edmonton", label: "Mountain Time — Edmonton (MT)" },
  { value: "America/Phoenix", label: "Mountain Time — Phoenix (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific Time — Los Angeles (PT)" },
  { value: "America/Vancouver", label: "Pacific Time — Vancouver (PT)" },
  { value: "America/Anchorage", label: "Alaska Time — Anchorage (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time — Honolulu (HST)" },
  { value: "America/Halifax", label: "Atlantic Time — Halifax (AT)" },
  { value: "America/Mexico_City", label: "Central Time — Mexico City" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Dublin", label: "Dublin (GMT/IST)" },
  { value: "Europe/Paris", label: "Central European Time — Paris" },
  { value: "Europe/Madrid", label: "Central European Time — Madrid" },
  { value: "Europe/Rome", label: "Central European Time — Rome" },
  { value: "Europe/Berlin", label: "Central European Time — Berlin" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
  { value: "Pacific/Auckland", label: "Auckland (NZST/NZDT)" },
];

/** Supported settlement currencies for the basic settings step. */
export const CURRENCIES: Option[] = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "AUD", label: "AUD — Australian Dollar" },
  { value: "NZD", label: "NZD — New Zealand Dollar" },
];

export type DayMeta = { value: number; label: string; short: string };

/** Sunday-first week, matching `day_of_week` 0–6 in the database. */
export const DAYS_OF_WEEK: DayMeta[] = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

export const WEEK_START_OPTIONS: Option[] = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
];

/** Venue brand defaults — the Wevenu sage palette, editable per venue. */
export const DEFAULT_PRIMARY_COLOR = "#5D6F5D";
export const DEFAULT_SECONDARY_COLOR = "#4F5F4F";
export const DEFAULT_TIMEZONE = "America/New_York";

/** A small on-brand palette offered as quick brand-color swatches. */
export const BRAND_COLOR_SWATCHES: string[] = [
  "#5D6F5D", // Heritage Sage
  "#4F5F4F", // Forest Sage
  "#B9D1C2", // Soft Sage
  "#B8AEA1", // Taupe Beige Dark
  "#DED6CA", // Taupe Beige Light
  "#D8A7AA", // Dusty Rose
  "#000000", // Black
  "#FFFFFF", // True White
];

/** Default operating hours: open Tue–Sun, closed Monday (typical for venues). */
export function defaultBusinessHours(): BusinessHourInput[] {
  return DAYS_OF_WEEK.map((d) => {
    const closed = d.value === 1; // Monday closed by default
    return {
      dayOfWeek: d.value,
      isOpen: !closed,
      openTime: closed ? "" : "09:00",
      closeTime: closed ? "" : "22:00",
    };
  });
}

/**
 * Build a blank Setup model, optionally pre-filling the owner's email from the
 * authenticated account.
 */
export function createInitialSetupInput(prefillEmail = ""): VenueSetupInput {
  return {
    name: "",
    businessName: "",
    email: prefillEmail,
    phone: "",
    website: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    stateRegion: "",
    postalCode: "",
    country: "",
    venueType: "",
    capacity: "",
    timezone: DEFAULT_TIMEZONE,
    businessHours: defaultBusinessHours(),
    logoUrl: "",
    primaryColor: DEFAULT_PRIMARY_COLOR,
    secondaryColor: DEFAULT_SECONDARY_COLOR,
    accentColor: "#B8AEA1",
    neutralColor: "#F7F5F1",
    ownerFullName: "",
    ownerEmail: prefillEmail,
    ownerTitle: "Owner",
    currency: "USD",
    weekStartsOn: 0,
    stripeOnboardingStatus: "not_started",
  };
}
