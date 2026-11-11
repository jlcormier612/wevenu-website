/**
 * Couple timeline add path requires at least one section with clientCanAdd.
 * Template apply historically inserted venue-owned entries with no such section.
 */
import * as repo from "@/lib/timeline/repository";
import type { TimelineSection } from "@/lib/timeline/types";

export const COUPLE_ADDITIONS_SECTION_NAME = "Your additions";

type DbClient = Parameters<typeof repo.getSections>[0];

/** Prefer an existing couple-addable section; otherwise create "Your additions". */
export async function ensureCoupleAdditionsSection(
  client: DbClient,
  venueId: string,
  eventId: string,
): Promise<TimelineSection> {
  const sections = await repo.getSections(client, venueId, eventId);
  const addable = sections.find((s) => s.clientCanAdd);
  if (addable) return addable;

  const named = sections.find(
    (s) => s.name.trim().toLowerCase() === COUPLE_ADDITIONS_SECTION_NAME.toLowerCase(),
  );
  if (named) {
    await repo.setSectionClientCanAdd(client, venueId, named.id, true);
    return { ...named, clientCanAdd: true };
  }

  return repo.insertSection(
    client,
    venueId,
    eventId,
    COUPLE_ADDITIONS_SECTION_NAME,
    sections.length,
    { clientCanAdd: true },
  );
}
