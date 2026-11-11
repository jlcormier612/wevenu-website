/**
 * Pure helpers for the New Request client selector.
 * Matching contract matches Calendar Related-to / clients repository search
 * (first, last, partner, email — case-insensitive substring). SQL enforces
 * venue scope; this module only documents and tests the contract.
 */
import {
  scheduleRelationRowMatchesQuery,
  scheduleRelationSubtitle,
  toScheduleRelationOption,
  type ScheduleRelationRow,
} from "@/lib/calendar/schedule-relation-search";

export type RequestClientOption = {
  id: string;
  name: string;
  eventType: string | null;
  eventDate: string | null;
};

export type RequestClientSearchRow = ScheduleRelationRow;

export function toRequestClientOption(row: RequestClientSearchRow): RequestClientOption {
  const option = toScheduleRelationOption("client", row);
  return {
    id: option.id,
    name: option.name,
    eventType: option.eventType,
    eventDate: option.eventDate,
  };
}

export function requestClientSubtitle(
  option: Pick<RequestClientOption, "eventType" | "eventDate">,
): string | null {
  return scheduleRelationSubtitle(option);
}

/**
 * Case-insensitive substring across name/email fields. Multi-word queries
 * require every token to appear in at least one field (so "Ava Allen" and
 * partner-first queries still match without inventing a full-name column).
 */
export function requestClientMatchesQuery(row: RequestClientSearchRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (scheduleRelationRowMatchesQuery(row, q)) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return false;
  const fields = [
    row.first_name,
    row.last_name,
    row.partner_first_name,
    row.partner_last_name,
    row.email,
  ]
    .filter((v): v is string => !!v)
    .map((v) => v.toLowerCase());
  return tokens.every((token) => fields.some((field) => field.includes(token)));
}

/** Cap per query — never send the full venue client list to the browser. */
export const REQUEST_CLIENT_SEARCH_LIMIT = 12;
