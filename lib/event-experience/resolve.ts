/**
 * Canonical event_type → experience_profile resolver.
 *
 * Canonical stored values live on leads.event_type, clients.event_type, and
 * events.event_type. After an Event exists, Event is the operational writer
 * for type/date/guest count. This resolver does not read the database; the
 * caller passes the event type string.
 *
 * Inquiry-form aliases and known display labels are recognized so duplicate
 * vocabularies do not silently fall through to General Event as "Wedding".
 * Those other vocabularies are not rewritten here.
 */

import {
  EXPERIENCE_PROFILES,
  FALLBACK_EXPERIENCE_PROFILE_ID,
  type ExperienceProfileDefinition,
  type ExperienceProfileId,
} from "@/lib/event-experience/profiles";

/**
 * Explicit stored-value map. Keys are lowercase canonical event_type values.
 *
 * Wedding cluster: CRM types that are wedding occasions and are not in the
 * locked General Event catch-all list (bridal/baby shower, gala, birthday,
 * quinceañera, other, etc.).
 *
 * Unlisted / unknown / null → General Event (deterministic fallback).
 */
const EVENT_TYPE_VALUE_TO_PROFILE: Record<string, ExperienceProfileId> = {
  wedding: "wedding",
  elopement: "wedding",
  engagement_party: "wedding",
  rehearsal_dinner: "wedding",
  reception: "wedding",

  celebration_of_life: "celebration_of_life",
  anniversary: "anniversary",

  corporate: "corporate",
  corporate_event: "corporate",

  social_event: "general_event",
  birthday: "general_event",
  birthday_milestone: "general_event",
};

/**
 * Known display labels from CRM EVENT_TYPES, public inquiry types, and the
 * public tour scheduler's leftover label-as-value list. Lowercased.
 */
const EVENT_TYPE_LABEL_TO_PROFILE: Record<string, ExperienceProfileId> = {
  wedding: "wedding",
  elopement: "wedding",
  "engagement party": "wedding",
  "rehearsal dinner": "wedding",
  "reception only": "wedding",

  "celebration of life": "celebration_of_life",
  "anniversary celebration": "anniversary",
  anniversary: "anniversary",

  "corporate event": "corporate",

  "birthday party": "general_event",
  "birthday / milestone": "general_event",
  "bridal / baby shower": "general_event",
  "gala / fundraiser": "general_event",
  retreat: "general_event",
  quinceañera: "general_event",
  quinceanera: "general_event",
  "social event": "general_event",
  other: "general_event",
};

export function resolveExperienceProfileId(
  eventType: string | null | undefined,
): ExperienceProfileId {
  if (eventType == null) return FALLBACK_EXPERIENCE_PROFILE_ID;
  const trimmed = eventType.trim();
  if (!trimmed) return FALLBACK_EXPERIENCE_PROFILE_ID;

  const lower = trimmed.toLowerCase();
  const fromValue = EVENT_TYPE_VALUE_TO_PROFILE[lower];
  if (fromValue) return fromValue;

  const fromLabel = EVENT_TYPE_LABEL_TO_PROFILE[lower];
  if (fromLabel) return fromLabel;

  return FALLBACK_EXPERIENCE_PROFILE_ID;
}

export function resolveExperienceProfile(
  eventType: string | null | undefined,
): ExperienceProfileDefinition {
  return EXPERIENCE_PROFILES[resolveExperienceProfileId(eventType)];
}

/**
 * Prefer the Event's type (the occasion). Fall back to the Client denormalized
 * type when no event type is present.
 */
export function resolveExperienceProfileForClientEvent(
  eventType: string | null | undefined,
  clientEventType?: string | null,
): ExperienceProfileDefinition {
  const preferred = eventType != null && eventType.trim() !== "" ? eventType : clientEventType;
  return resolveExperienceProfile(preferred);
}
