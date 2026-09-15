/**
 * Couple journal auto-memories (create_auto_memory) are internal Luv/activity
 * signals. They stay in couple_journal_entries. They must not appear as
 * customer-facing Story / Memories / public website narrative.
 */
import type { JournalEntry } from "@/lib/portal/types";

export function isCustomerFacingJournalEntry(
  entry: Pick<JournalEntry, "source"> | null | undefined,
): boolean {
  if (!entry) return false;
  return entry.source !== "auto";
}

export function customerFacingJournalEntries<T extends Pick<JournalEntry, "source">>(
  entries: T[] | null | undefined,
): T[] {
  return (entries ?? []).filter(isCustomerFacingJournalEntry);
}

export function customerFacingLatestJournalEntry<T extends Pick<JournalEntry, "source">>(
  entry: T | null | undefined,
): T | null {
  if (!entry || !isCustomerFacingJournalEntry(entry)) return null;
  return entry;
}
