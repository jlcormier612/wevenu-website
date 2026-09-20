/**
 * Locked venue-internal notes UX copy.
 *
 * Venue/staff operational notes must never be visible to the client/couple.
 * Every venue-internal notes editor uses this label + privacy line so
 * coordinators can write candid notes without wondering who can see them.
 *
 * Do NOT apply this copy to couple-owned, customer-facing, or shared notes
 * (invoice notes, payment-schedule notes shown as "Notes from your venue",
 * guest notes, meal notes, etc.).
 */
export const INTERNAL_NOTES_LABEL = "Internal notes";

export const INTERNAL_NOTES_PRIVACY_HINT =
  "Private to your venue team — never visible to the client.";

/** Contextual labels — the word Internal must remain visible. */
export type InternalNotesScope =
  | "default"
  | "tour"
  | "vendor"
  | "task"
  | "payment"
  | "timeline"
  | "event"
  | "lead"
  | "client";

export function internalNotesLabel(scope: InternalNotesScope = "default"): string {
  switch (scope) {
    case "tour":
      return "Internal tour notes";
    case "vendor":
      return "Internal vendor notes";
    case "task":
      return "Internal task notes";
    case "payment":
      return "Internal payment notes";
    case "timeline":
      return "Internal timeline notes";
    case "event":
    case "lead":
    case "client":
    case "default":
    default:
      return INTERNAL_NOTES_LABEL;
  }
}

/** Customer-facing payment schedule / invoice notes — never labeled Internal. */
export const NOTES_FROM_YOUR_VENUE_LABEL = "Notes from your venue";

export const NOTES_FROM_YOUR_VENUE_HINT =
  "Shown to the couple on their payment schedule and invoices.";
