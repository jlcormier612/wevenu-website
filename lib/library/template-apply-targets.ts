/**
 * Client-first Use Template targets.
 * Events remain the apply key; cancelled events never appear in the picker.
 */

export type TemplateApplyEventTarget = {
  id: string;
  name: string;
  eventDate: string;
  status: string;
  clientId: string;
  clientDisplayName: string;
};

export type TemplateApplyClientGroup = {
  clientId: string;
  clientDisplayName: string;
  events: TemplateApplyEventTarget[];
};

/** Customer-facing picker eligibility — cancelled events are never shown. */
export function isTemplateApplyEventEligible(status: string): boolean {
  return status !== "cancelled";
}

export function formatClientDisplayName(parts: {
  firstName: string;
  lastName: string;
  partnerFirstName?: string | null;
  partnerLastName?: string | null;
}): string {
  const primary = [parts.firstName, parts.lastName].filter(Boolean).join(" ").trim();
  const partner = [parts.partnerFirstName, parts.partnerLastName].filter(Boolean).join(" ").trim();
  if (primary && partner) return `${primary} & ${partner}`;
  return primary || partner || "Client";
}

/**
 * Groups eligible events under their client. Clients with zero eligible events
 * are omitted. Multi-event clients keep every non-cancelled event.
 */
export function groupTemplateApplyTargets(
  events: TemplateApplyEventTarget[],
): TemplateApplyClientGroup[] {
  const byClient = new Map<string, TemplateApplyClientGroup>();
  for (const ev of events) {
    if (!isTemplateApplyEventEligible(ev.status)) continue;
    if (!ev.clientId) continue;
    const existing = byClient.get(ev.clientId);
    if (existing) {
      existing.events.push(ev);
    } else {
      byClient.set(ev.clientId, {
        clientId: ev.clientId,
        clientDisplayName: ev.clientDisplayName,
        events: [ev],
      });
    }
  }
  const groups = [...byClient.values()];
  for (const g of groups) {
    g.events.sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.name.localeCompare(b.name));
  }
  groups.sort((a, b) => a.clientDisplayName.localeCompare(b.clientDisplayName));
  return groups;
}

/** Client list search: match client name or any nested event name/date. */
export function filterTemplateApplyClientGroups(
  groups: TemplateApplyClientGroup[],
  query: string,
): TemplateApplyClientGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups.filter((g) => {
    if (g.clientDisplayName.toLowerCase().includes(q)) return true;
    return g.events.some(
      (e) => e.name.toLowerCase().includes(q) || e.eventDate.includes(q),
    );
  });
}
