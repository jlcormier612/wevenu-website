/**
 * Contracts list presentation identity — client/couple primary,
 * contract type secondary. Does not change contract storage or lifecycle.
 *
 * Authoritative client naming matches repository join / clientDisplayName.
 * Type label prefers linked template name; otherwise the title prefix before
 * " — " (default construction: "Venue Rental Agreement — {client}").
 * Raw document/template titles must not dominate the list primary.
 */

export function contractListPrimaryTitle(c: {
  clientName: string | null | undefined;
  title: string;
}): string {
  const name = c.clientName?.trim();
  if (name) return name;
  return c.title.trim() || "Contract";
}

/**
 * Secondary type/category label for the list.
 * Never invents a new taxonomy — uses template name or title prefix only.
 */
export function contractListSecondaryLabel(c: {
  title: string;
  clientName?: string | null;
  templateName?: string | null;
}): string {
  const fromTemplate = c.templateName?.trim();
  if (fromTemplate) return fromTemplate;

  const title = c.title.trim();
  const sep = " — ";
  const idx = title.lastIndexOf(sep);
  if (idx > 0) {
    const prefix = title.slice(0, idx).trim();
    if (prefix) return prefix;
  }

  // Client is primary; avoid repeating a freeform test/document title as type.
  if (c.clientName?.trim()) return "Contract";
  return title || "Contract";
}

/** True when primary is client-driven (document title is not the list identity). */
export function contractListUsesClientPrimary(c: {
  clientName: string | null | undefined;
}): boolean {
  return Boolean(c.clientName?.trim());
}
