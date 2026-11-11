/**
 * Event use → physical space assignment helpers.
 * Multi-space venues only; single-space venues keep Event.space_id UX.
 */

import type { VenueSpace } from "@/lib/availability/types";
import { labelForUseKey, SUGGESTED_SPACE_USES } from "@/lib/venue-spaces/uses";

export type EventSpaceAssignmentInput = {
  useKey: string;
  useLabel: string;
  spaceId: string;
  /** When set, this use occupies only this window. Blank uses the event window. */
  startTime?: string | null;
  endTime?: string | null;
  /**
   * Calendar day this use occupies (YYYY-MM-DD). Null = every day in the
   * event's protected range (legacy multi-day envelope).
   */
  scheduledDate?: string | null;
};

export type EventSpaceAssignment = EventSpaceAssignmentInput & {
  id?: string;
  sortOrder: number;
  spaceName?: string | null;
};

/** Union of permitted uses across active spaces (venue-configured only). */
export function configuredUsesFromSpaces(
  spaces: VenueSpace[],
): Array<{ key: string; label: string }> {
  const ordered: Array<{ key: string; label: string }> = [];
  const seen = new Set<string>();

  // Prefer suggested order when present, then any custom keys.
  for (const suggested of SUGGESTED_SPACE_USES) {
    const enabled = spaces.some(
      (s) => s.isActive && (s.permittedUses ?? []).includes(suggested.key),
    );
    if (enabled && !seen.has(suggested.key)) {
      seen.add(suggested.key);
      ordered.push({ key: suggested.key, label: suggested.label });
    }
  }

  for (const space of spaces.filter((s) => s.isActive)) {
    for (const key of space.permittedUses ?? []) {
      const trimmed = key.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      ordered.push({ key: trimmed, label: labelForUseKey(trimmed) });
    }
  }

  return ordered;
}

/** Spaces that may be chosen for a use (empty permittedUses = unrestricted). */
export function spacesEligibleForUse(spaces: VenueSpace[], useKey: string): VenueSpace[] {
  return spaces.filter((s) => {
    if (!s.isActive) return false;
    const uses = s.permittedUses ?? [];
    if (uses.length === 0) return true;
    return uses.includes(useKey);
  });
}

/**
 * Whether a space's configured permitted_uses allow this use key.
 * Empty / missing permittedUses = unrestricted (same rule as spacesEligibleForUse
 * and venue_spaces.permitted_uses column comment).
 */
export function spaceAllowsUse(
  space: Pick<VenueSpace, "permittedUses"> | null | undefined,
  useKey: string,
): boolean {
  const key = useKey.trim();
  if (!key) return false;
  const uses = space?.permittedUses ?? [];
  if (uses.length === 0) return true;
  return uses.includes(key);
}

/**
 * First disallowed assignment, or null when every row is allowed.
 * Unknown / inactive spaces are reported separately so callers can refuse
 * before a partial replace. Matches replace_event_space_assignments SoT.
 */
export function permittedUseAssignmentError(
  assignments: EventSpaceAssignmentInput[],
  spaces: Array<Pick<VenueSpace, "id" | "name" | "isActive" | "permittedUses">>,
): string | null {
  const byId = new Map(spaces.map((s) => [s.id, s]));
  for (const row of assignments) {
    const useKey = row.useKey.trim();
    const spaceId = row.spaceId.trim();
    if (!useKey || !spaceId) continue;
    const space = byId.get(spaceId);
    if (!space || !space.isActive) {
      return "That Event Space does not belong to this venue or is inactive.";
    }
    if (!spaceAllowsUse(space, useKey)) {
      const useLabel = row.useLabel.trim() || labelForUseKey(useKey);
      const spaceName = space.name?.trim() || "This space";
      return `${spaceName} cannot be used for ${useLabel}. Choose a space that allows this use, or update the space’s permitted uses in Availability settings.`;
    }
  }
  return null;
}

/**
 * Primary space for events.space_id / availability.
 * Wedding family: reception → ceremony → other assigned space.
 * Non-wedding: first assigned space in list order (relevant-use order).
 * The same physical space may appear on more than one use; we still persist one FK.
 */
export function primarySpaceIdFromAssignments(
  assignments: EventSpaceAssignmentInput[],
  opts?: { weddingFamily?: boolean },
): string | null {
  const withSpace = assignments.filter((a) => a.spaceId.trim());
  const weddingFamily = opts?.weddingFamily !== false;
  if (weddingFamily) {
    const reception = withSpace.find((a) => a.useKey === "reception");
    if (reception) return reception.spaceId.trim();
    const ceremony = withSpace.find((a) => a.useKey === "ceremony");
    if (ceremony) return ceremony.spaceId.trim();
  }
  return withSpace[0]?.spaceId.trim() || null;
}

export function normalizeAssignmentInputs(
  assignments: EventSpaceAssignmentInput[],
): EventSpaceAssignmentInput[] {
  const byKey = new Map<string, EventSpaceAssignmentInput>();
  for (const raw of assignments) {
    const useKey = raw.useKey.trim();
    const spaceId = raw.spaceId.trim();
    if (!useKey || !spaceId) continue;
    byKey.set(useKey, {
      useKey,
      useLabel: (raw.useLabel.trim() || labelForUseKey(useKey)),
      spaceId,
      startTime: raw.startTime ?? null,
      endTime: raw.endTime ?? null,
      scheduledDate: raw.scheduledDate?.trim() || null,
    });
  }
  return [...byKey.values()];
}

/**
 * When an event update omits component schedule fields (partial payload),
 * keep the persisted date/times for matching use keys. Explicit null clears.
 * Does not invent dates from the overall event date.
 */
export function preserveOmittedComponentScheduleFields(
  incoming: EventSpaceAssignmentInput[],
  existing: Array<Pick<EventSpaceAssignmentInput, "useKey" | "startTime" | "endTime" | "scheduledDate">>,
): EventSpaceAssignmentInput[] {
  const prevByKey = new Map(existing.map((e) => [e.useKey, e]));
  return incoming.map((row) => {
    const prev = prevByKey.get(row.useKey);
    if (!prev) return row;
    return {
      ...row,
      startTime: Object.prototype.hasOwnProperty.call(row, "startTime")
        ? row.startTime
        : prev.startTime ?? null,
      endTime: Object.prototype.hasOwnProperty.call(row, "endTime")
        ? row.endTime
        : prev.endTime ?? null,
      scheduledDate: Object.prototype.hasOwnProperty.call(row, "scheduledDate")
        ? row.scheduledDate
        : prev.scheduledDate ?? null,
    };
  });
}

/**
 * When the timed assignment editor shows a date input for a row that has a
 * space but no scheduledDate, the visible default is the overall event date.
 * Materialize that value into state so submit persists what the venue saw —
 * never leave a phantom display date that saves as null.
 * Does not overwrite an explicit component date.
 */
export function materializeMissingScheduledDates(
  assignments: EventSpaceAssignmentInput[],
  eventDate: string,
): { next: EventSpaceAssignmentInput[]; changed: boolean } {
  const fallback = eventDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fallback)) {
    return { next: assignments, changed: false };
  }
  let changed = false;
  const next = assignments.map((row) => {
    if (!row.spaceId.trim()) return row;
    if (row.scheduledDate?.trim()) return row;
    changed = true;
    return { ...row, scheduledDate: fallback };
  });
  return { next, changed };
}

function hhmm(value: string | null | undefined): string | null {
  const t = value?.trim() ?? "";
  if (!t) return null;
  return t.slice(0, 5);
}

/**
 * Same physical space cannot host overlapping component windows on the same
 * calendar date within one event (e.g. Sat rehearsal + Sat reception).
 */
export function intraEventSpaceOverlapError(
  assignments: EventSpaceAssignmentInput[],
): string | null {
  const timed = assignments
    .map((row) => ({
      label: row.useLabel.trim() || labelForUseKey(row.useKey),
      spaceId: row.spaceId.trim(),
      date: row.scheduledDate?.trim() || "",
      start: hhmm(row.startTime),
      end: hhmm(row.endTime),
    }))
    .filter((row) => row.spaceId && row.date && row.start && row.end);
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i]!;
      const b = timed[j]!;
      if (a.spaceId !== b.spaceId || a.date !== b.date) continue;
      if (a.start! < b.end! && b.start! < a.end!) {
        return `${a.label} and ${b.label} overlap in the same space on ${a.date}.`;
      }
    }
  }
  return null;
}
