/**
 * Pure Inbox search matching — venue-facing discovery without a search engine.
 * Matches name, email, phone digits, and event dates (incl. month names).
 */
import type { ConversationSummary } from "@/lib/conversations/types";

const MONTHS: { name: string; index: number }[] = [
  { name: "january", index: 0 }, { name: "february", index: 1 }, { name: "march", index: 2 },
  { name: "april", index: 3 }, { name: "may", index: 4 }, { name: "june", index: 5 },
  { name: "july", index: 6 }, { name: "august", index: 7 }, { name: "september", index: 8 },
  { name: "october", index: 9 }, { name: "november", index: 10 }, { name: "december", index: 11 },
];

export function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Parse "october", "oct", "october 2027", "2027-10", "2027-10-12". */
export function parseEventDateQuery(raw: string): {
  monthIndex: number | null;
  year: number | null;
  exactDay: string | null; // YYYY-MM-DD
  yearMonth: string | null; // YYYY-MM
} {
  const q = raw.trim().toLowerCase();
  const isoDay = q.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDay) {
    return { monthIndex: Number(isoDay[2]) - 1, year: Number(isoDay[1]), exactDay: isoDay[0], yearMonth: `${isoDay[1]}-${isoDay[2]}` };
  }
  const isoMonth = q.match(/^(\d{4})-(\d{2})$/);
  if (isoMonth) {
    return { monthIndex: Number(isoMonth[2]) - 1, year: Number(isoMonth[1]), exactDay: null, yearMonth: isoMonth[0] };
  }

  let monthIndex: number | null = null;
  for (const m of MONTHS) {
    if (q === m.name || q.startsWith(m.name + " ") || q.includes(" " + m.name) || (m.name.length >= 3 && q === m.name.slice(0, 3))) {
      monthIndex = m.index;
      break;
    }
  }
  // "wedding in october" / "october wedding"
  if (monthIndex == null) {
    for (const m of MONTHS) {
      if (new RegExp(`\\b${m.name}\\b`).test(q)) {
        monthIndex = m.index;
        break;
      }
    }
  }

  const yearMatch = q.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  return { monthIndex, year, exactDay: null, yearMonth: null };
}

function eventDateMatches(eventDate: string | null | undefined, query: string): boolean {
  if (!eventDate) return false;
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (eventDate.toLowerCase().includes(q)) return true;

  const parsed = parseEventDateQuery(q);
  if (parsed.exactDay) return eventDate === parsed.exactDay;
  if (parsed.yearMonth) return eventDate.startsWith(parsed.yearMonth);

  // Formatted display fragments ("oct", "october")
  try {
    const d = new Date(eventDate + "T12:00:00");
    if (Number.isNaN(d.getTime())) return false;
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric", day: "numeric" }).toLowerCase();
    const short = d.toLocaleDateString("en-US", { month: "short", year: "numeric", day: "numeric" }).toLowerCase();
    if (label.includes(q) || short.includes(q)) return true;

    if (parsed.monthIndex != null) {
      const monthOk = d.getMonth() === parsed.monthIndex;
      const yearOk = parsed.year == null || d.getFullYear() === parsed.year;
      return monthOk && yearOk;
    }
  } catch {
    return false;
  }
  return false;
}

export function conversationMatchesInboxSearch(
  conversation: ConversationSummary,
  rawQuery: string,
): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;

  if ((conversation.displayName ?? "").toLowerCase().includes(q)) return true;

  const email = (conversation.searchEmail ?? "").toLowerCase();
  if (email && email.includes(q)) return true;

  const queryDigits = digitsOnly(q);
  if (queryDigits.length >= 3) {
    const phoneDigits = digitsOnly(conversation.searchPhone);
    if (phoneDigits && phoneDigits.includes(queryDigits)) return true;
  }

  if (eventDateMatches(conversation.eventDate, q)) return true;

  // Free-text "wedding in october" — month/date already handled; optional event type hint
  const eventType = (conversation.eventType ?? "").toLowerCase();
  if (eventType && q.includes(eventType)) {
    // Only treat as match when a date cue is also present (avoid "wedding" matching all weddings alone)
    const parsed = parseEventDateQuery(q);
    if (parsed.monthIndex != null || parsed.year != null || parsed.exactDay || parsed.yearMonth) {
      return eventDateMatches(conversation.eventDate, q);
    }
  }

  return false;
}
