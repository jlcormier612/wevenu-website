/**
 * Representative cutover fixture for Sandbox / local E2E.
 * Counts match the launch verification brief.
 */
export const CUTOVER_E2E_COUNTS = {
  clients: 75,
  futureEvents: 30,
  pastEvents: 20,
  tours: 12,
  pastTours: 4,
  futureTours: 8,
  holds: 8,
  blockedDates: 15,
  recurringBlocks: 1,
  spaces: 2,
  vendors: 5,
  packages: 3,
  keyDates: 10,
} as const;

export const CUTOVER_E2E_CHECKLIST = [
  "Configure timezone, business hours, 2 Event Spaces, capacity ≥ 2, turnaround, tour windows",
  "Import calendar_block rows (15 blocked + 1 weekly recurring) via Migration Center — verify Calendar + availability refusal",
  "Import date_hold rows (8) — verify holds appear (soft reservations; they do not refuse Event occupancy)",
  "Import leads then tour rows (12) via book_tour_for_migration — past completed, future scheduled",
  "Import clients with endDate/times/spaceName (75; 30 dated future, 20 past complete) — verify Events on Calendar and occupancy",
  "Retry same files — duplicate_exact / sourceId skip, no duplicates",
  "Force a space conflict — needs_review surfaces engine message; source booking unchanged",
  "Past Event occupancy conflict — reviewed “Import as historical record — will not affect future availability.”",
  "Venue can book a new tour/event after import without empty-calendar behavior",
] as const;
