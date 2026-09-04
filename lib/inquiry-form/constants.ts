/**
 * Public inquiry form constants.
 * Event-type vocabulary lives in lib/event-types/canonical.ts.
 */

import type { InquiryFormFieldsConfig, StandardFieldKey } from "@/lib/inquiry-form/types";
import {
  DEFAULT_ACCEPTED_EVENT_TYPES,
  EVENT_TYPES,
} from "@/lib/event-types/canonical";

export { EVENT_TYPES, DEFAULT_ACCEPTED_EVENT_TYPES };

/** @deprecated Prefer EVENT_TYPES / DEFAULT_ACCEPTED_EVENT_TYPES from canonical. */
export const PUBLIC_INQUIRY_EVENT_TYPES = EVENT_TYPES;

/** Default accepted subset shown on public inquiry for new venues. */
export const DEFAULT_PUBLIC_ACCEPTED_EVENT_TYPES = DEFAULT_ACCEPTED_EVENT_TYPES;

export const DEFAULT_INQUIRY_FORM_FIELDS: InquiryFormFieldsConfig = {
  phone: "optional",
  partner: "optional",
  guest_count: "optional",
  estimated_budget: "optional",
  preferred_event_date: "optional",
  event_details: "optional",
};

export const STANDARD_FIELD_LABELS: Record<StandardFieldKey, string> = {
  phone: "Phone",
  partner: "Partner / Co-host",
  guest_count: "Guest count",
  estimated_budget: "Estimated budget",
  preferred_event_date: "Preferred event date",
  event_details: "Tell us about your event",
};

export const INQUIRY_API_ERRORS: Record<string, string> = {
  event_type_required: "Event type is required.",
  event_type_not_accepted: "That event type is not accepted by this venue. Please choose another.",
  date_unavailable: "That date is no longer available. Please choose another date.",
  slot_unavailable: "That time is no longer available. Please choose another time.",
  slot_taken: "That time is no longer available. Please choose another time.",
};
