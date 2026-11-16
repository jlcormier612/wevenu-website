/**
 * Setup Profile “Used for” options and assignment validation.
 *
 * Public inquiry accepted types and Setup Profile assignments are independent.
 * The editor exposes the full canonical catalog. Venues may assign a profile
 * to a type they do not currently advertise on public inquiry forms.
 */
import {
  EVENT_TYPES,
  eventTypeLabel,
  isCanonicalEventType,
  normalizeEventType,
  parseAcceptedEventTypes,
} from "@/lib/event-types/canonical";

export const SETUP_PROFILE_UNACCEPTED_EVENT_TYPE_MESSAGE =
  "That event type is not a Hello to Cheers event type.";

export type SetupProfileUsedForOption = {
  value: string;
  /** Checkbox / list label — wedding displays as Wedding. */
  label: string;
};

export function suggestedSetupProfileName(eventType?: string | null): string {
  if (eventType === "corporate") return "Corporate Event Setup";
  if (eventType === "social_event") return "Social Celebration Setup";
  return "Standard Wedding Setup";
}

/**
 * Options for the Setup Profile “Used for” event-type checkboxes.
 * Full canonical catalog, independent of public inquiry acceptance.
 */
export function buildSetupProfileUsedForOptions(
  _acceptedRaw?: unknown,
): SetupProfileUsedForOption[] {
  return EVENT_TYPES.map((opt) => ({
    value: opt.value,
    label: opt.label,
  }));
}

/**
 * Any canonical event type is valid for Setup Profile assignment,
 * including types the venue does not currently accept on public inquiry.
 */
export function validateSetupProfileEventTypes(
  eventTypes: readonly string[],
  _acceptedRaw?: unknown,
):
  | { ok: true; eventTypes: string[] }
  | { ok: false; message: string } {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const raw of eventTypes) {
    const key = normalizeEventType(raw);
    if (!key || !isCanonicalEventType(key)) {
      return { ok: false, message: SETUP_PROFILE_UNACCEPTED_EVENT_TYPE_MESSAGE };
    }
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }

  return { ok: true, eventTypes: normalized };
}

/** Event types present in previous accepted set but not in next. */
export function removedAcceptedEventTypes(
  previousAcceptedRaw: unknown,
  nextAcceptedRaw: unknown,
): string[] {
  const previous = parseAcceptedEventTypes(previousAcceptedRaw);
  const next = new Set(parseAcceptedEventTypes(nextAcceptedRaw));
  return previous.filter((type) => !next.has(type));
}

/**
 * Inquiry accepted-type changes must not delete Setup Profile assignments.
 * Always returns an empty list so leftover callers are a no-op.
 */
export function assignmentTypesToPruneOnInquiryRemoval(
  _removedEventTypes: readonly string[],
): string[] {
  return [];
}

export type SetupProfileAssignmentConflict = {
  eventType: string;
  eventTypeLabel: string;
  profileId: string;
  profileName: string;
};

export type SetupProfileConflictAck = {
  eventType: string;
  profileId: string;
};

const EVENT_TYPE_ORDER = new Map(EVENT_TYPES.map((opt, index) => [opt.value, index]));

function conflictKey(conflict: { eventType: string; profileId: string }): string {
  return `${conflict.eventType}:${conflict.profileId}`;
}

export function sameSetupProfileConflictSet(
  left: readonly SetupProfileConflictAck[],
  right: readonly SetupProfileConflictAck[],
): boolean {
  if (left.length !== right.length) return false;
  const rightKeys = new Set(right.map(conflictKey));
  return left.every((item) => rightKeys.has(conflictKey(item)));
}

export function requiresAssignmentMoveConfirmation(
  conflicts: readonly SetupProfileAssignmentConflict[],
  confirmed: readonly SetupProfileConflictAck[] | undefined,
): boolean {
  if (conflicts.length === 0) return false;
  return !sameSetupProfileConflictSet(conflicts, confirmed ?? []);
}

/**
 * Event types the saving profile is claiming that currently belong to a
 * different persisted Setup Profile. Venue default is not an event type.
 */
export function findSetupProfileAssignmentConflicts(args: {
  claimedEventTypes: readonly string[];
  savingProfileId: string | null;
  assignments: readonly { profileId: string; eventType: string | null }[];
  profiles: readonly { id: string; name: string }[];
}): SetupProfileAssignmentConflict[] {
  const names = new Map(args.profiles.map((profile) => [profile.id, profile.name]));
  const claimed = new Set(
    args.claimedEventTypes
      .map((value) => normalizeEventType(value))
      .filter((value): value is string => !!value),
  );
  const conflicts: SetupProfileAssignmentConflict[] = [];

  for (const row of args.assignments) {
    if (row.eventType == null) continue;
    const eventType = normalizeEventType(row.eventType);
    if (!eventType || !claimed.has(eventType)) continue;
    if (args.savingProfileId && row.profileId === args.savingProfileId) continue;
    conflicts.push({
      eventType,
      eventTypeLabel: eventTypeLabel(eventType) || eventType,
      profileId: row.profileId,
      profileName: names.get(row.profileId) || "another setup",
    });
  }

  conflicts.sort((a, b) => {
    const aOrder = EVENT_TYPE_ORDER.get(a.eventType) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = EVENT_TYPE_ORDER.get(b.eventType) ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.profileName.localeCompare(b.profileName);
  });
  return conflicts;
}

export function setupProfileReassignDialogCopy(
  conflicts: readonly SetupProfileAssignmentConflict[],
): { title: string; description: string } {
  if (conflicts.length === 1) {
    const conflict = conflicts[0]!;
    return {
      title: "Move this event type?",
      description:
        `${conflict.eventTypeLabel} is currently assigned to ‘${conflict.profileName}.’ Saving will move it to this Setup Profile. Existing booked events will not be changed.`,
    };
  }
  const lines = conflicts
    .map((conflict) => `${conflict.eventTypeLabel} — ${conflict.profileName}`)
    .join("\n");
  return {
    title: "Move these event types?",
    description:
      `These event types are currently assigned to other Setup Profiles. Saving will move them to this Setup Profile. Existing booked events will not be changed.\n\n${lines}`,
  };
}
