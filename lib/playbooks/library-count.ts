/**
 * Templates hub badge: how many Planning Templates are in this venue's library.
 * Counts active (non-archived) Client + Venue rows only — not starter-example cards.
 */
export function countActivePlanningLibraryTemplates(
  templates: ReadonlyArray<{ kind: string; isArchived: boolean }>,
): number {
  return templates.filter(
    (t) => !t.isArchived && (t.kind === "client" || t.kind === "venue"),
  ).length;
}
