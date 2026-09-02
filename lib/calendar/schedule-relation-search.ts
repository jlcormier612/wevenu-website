/**
 * Pure logic behind the Calendar "Related to" relationship picker —
 * Calendar Related-To Search Scalability.
 *
 * Kept separate from lib/calendar/service.ts's DB-touching search so the
 * matching/formatting/grouping rules are unit-testable without Supabase —
 * the same split this module already uses for recurrence.ts and
 * schedule-item-times.ts vs. service.ts/repository.ts.
 *
 * scheduleRelationRowMatchesQuery documents and tests the matching contract
 * (name or email, case-insensitive substring) that
 * lib/calendar/service.ts's `.or(ilike...)` query is written to satisfy —
 * the same first/last/partner-first/partner-last/email shape already
 * established by lib/leads/repository.ts and lib/clients/repository.ts's
 * own search filters. The actual filtering happens in SQL, not here, so a
 * venue with hundreds of relationships never has more than a query's worth
 * loaded into the browser.
 */
import { leadDisplayName, eventTypeLabel } from "@/lib/leads/constants";
import { clientDisplayName, formatDate } from "@/lib/clients/constants";
import type { ScheduleRelationOption } from "@/lib/calendar/types";

export type ScheduleRelationRow = {
  id: string;
  first_name: string;
  last_name: string;
  partner_first_name: string | null;
  partner_last_name: string | null;
  email: string | null;
  event_type: string | null;
  event_date: string | null;
};

/** Row → display option. One canonical mapping — Leads and Clients rows share this exact shape. */
export function toScheduleRelationOption(kind: "lead" | "client", row: ScheduleRelationRow): ScheduleRelationOption {
  const name = kind === "lead"
    ? leadDisplayName(row.first_name, row.last_name, row.partner_first_name, row.partner_last_name)
    : clientDisplayName(row.first_name, row.last_name, row.partner_first_name, row.partner_last_name);
  return { kind, id: row.id, name, eventType: row.event_type, eventDate: row.event_date };
}

/**
 * "Wedding · Aug 12, 2028" — enough context to tell two same-named couples
 * apart. Either half may be absent (a brand-new lead has no event date yet).
 */
export function scheduleRelationSubtitle(option: Pick<ScheduleRelationOption, "eventType" | "eventDate">): string | null {
  const parts = [
    option.eventType ? eventTypeLabel(option.eventType) : null,
    option.eventDate ? formatDate(option.eventDate) : null,
  ].filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export type ScheduleRelationGroup = { label: "Leads" | "Clients"; options: ScheduleRelationOption[] };

/** Fixed Leads-then-Clients grouping, always both groups so the caller can decide how to render an empty one. */
export function groupScheduleRelationOptions(leads: ScheduleRelationOption[], clients: ScheduleRelationOption[]): ScheduleRelationGroup[] {
  return [
    { label: "Leads", options: leads },
    { label: "Clients", options: clients },
  ];
}

export function hasScheduleRelationResults(groups: ScheduleRelationGroup[]): boolean {
  return groups.some((g) => g.options.length > 0);
}

/** The composite id the schedule-item payload and list `key`s use ("lead:<id>" / "client:<id>"). */
export function scheduleRelationOptionKey(option: Pick<ScheduleRelationOption, "kind" | "id">): string {
  return `${option.kind}:${option.id}`;
}

/**
 * Case-insensitive substring match across name and email — the contract
 * lib/calendar/service.ts's search query is written to satisfy. Not used to
 * filter results at runtime (that happens in SQL); exists so that contract
 * has one tested definition instead of living only as an untested `.or()`
 * string.
 */
export function scheduleRelationRowMatchesQuery(row: ScheduleRelationRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return [row.first_name, row.last_name, row.partner_first_name, row.partner_last_name, row.email]
    .some((v) => !!v && v.toLowerCase().includes(q));
}
