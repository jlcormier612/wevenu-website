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
 * Primary space for events.space_id / availability — first assigned row.
 * Same physical space may appear on multiple uses; we still pick one FK.
 */
export function primarySpaceIdFromAssignments(
  assignments: EventSpaceAssignmentInput[],
): string | null {
  const first = assignments.find((a) => a.spaceId.trim());
  return first?.spaceId.trim() || null;
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
    });
  }
  return [...byKey.values()];
}
