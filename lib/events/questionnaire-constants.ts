/**
 * Pure constants shared between the server-only questionnaire domain layer
 * (lib/events/questionnaire.ts, which imports next/headers via
 * integrations/supabase/server and can never be imported by a Client
 * Component) and the client-facing forms that need the same field
 * vocabulary. Kept in their own zero-dependency file for exactly that
 * reason — found live (a real 500) when final-details-form.tsx pulled
 * CONFIGURABLE_FIELDS in as a value import from the server module and
 * turbopack correctly refused to bundle next/headers into the client.
 */

export type QuestionnaireStatus = "draft" | "sent" | "submitted" | "reviewed";

// The six genuinely-optional couple-facing fields a questionnaire_templates
// row can toggle include/require on. The three safety/logistics fields
// (final_guest_count, emergency_contact_name/phone) are never in this list —
// D5's own finding grounded those in "the venue can't run the event without
// this," not a style preference, so they stay unconditionally required.
export const CONFIGURABLE_FIELDS = [
  "meal_notes", "processional_song", "recessional_song",
  "first_dance_song", "parent_dances", "special_requests",
] as const;
export type ConfigurableField = (typeof CONFIGURABLE_FIELDS)[number];
