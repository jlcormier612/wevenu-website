/**
 * Presentation rules for the staff Event Order document (Event Order tab).
 * Pure helpers — no records are changed by anything here.
 */

import { isInternalChoicesProvenanceNote } from "@/lib/event-orders/share-consistency";
import { packageNameFromSelectionNotes } from "@/lib/event-orders/seed-package-inclusions";
import type { EventOrderLine } from "@/lib/event-orders/types";

/** Plain-English source for a line's notes; internal stamps never show raw. */
export function staffLineNotesLabel(notes: string | null | undefined): string | null {
  if (!notes?.trim()) return null;
  const fromPackage = packageNameFromSelectionNotes(notes);
  if (fromPackage) return `From package: ${fromPackage}`;
  if (isInternalChoicesProvenanceNote(notes)) return "From the couple's selections";
  return notes;
}

/** Zero-cost inventory lines (chairs, linens…) fold under "Included setup items". */
export function isIncludedSetupLine(line: Pick<EventOrderLine, "provenance" | "amount">): boolean {
  return line.provenance === "inventory" && line.amount === 0;
}

export function splitSetupLines<T extends Pick<EventOrderLine, "provenance" | "amount">>(
  lines: T[],
): { main: T[]; setup: T[] } {
  const main: T[] = [];
  const setup: T[] = [];
  for (const line of lines) (isIncludedSetupLine(line) ? setup : main).push(line);
  return { main, setup };
}

function sectionKey(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

/** Couple choice groups render inside the Event Order section of the same name. */
export function matchChoiceGroupsToSections<G extends { sectionName: string | null }>(
  groups: G[],
  sections: { id: string; name: string }[],
): { bySectionId: Map<string, G[]>; unmatched: G[] } {
  const idByName = new Map<string, string>();
  for (const s of sections) {
    const key = sectionKey(s.name);
    if (key && !idByName.has(key)) idByName.set(key, s.id);
  }
  const bySectionId = new Map<string, G[]>();
  const unmatched: G[] = [];
  for (const group of groups) {
    const id = idByName.get(sectionKey(group.sectionName));
    if (!id) {
      unmatched.push(group);
      continue;
    }
    bySectionId.set(id, [...(bySectionId.get(id) ?? []), group]);
  }
  return { bySectionId, unmatched };
}
