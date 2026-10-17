/**
 * Optional reminder selection. Cron and Settings pass no scope.
 * A non-empty reminderIds list and a venueId are independent filters:
 * when both are set, a row must match both.
 * An empty reminderIds array does not filter by id.
 */
export type ReminderScope = {
  reminderIds?: string[];
  venueId?: string;
};

type ScopeQuery<Q> = Q & {
  in(column: string, values: string[]): Q;
  eq(column: string, value: string): Q;
};

export function applyReminderScope<Q>(query: ScopeQuery<Q>, scope?: ReminderScope): Q {
  let next: Q = query;
  if (scope?.reminderIds?.length) {
    next = query.in("id", scope.reminderIds);
  }
  if (scope?.venueId) {
    next = (next as ScopeQuery<Q>).eq("venue_id", scope.venueId);
  }
  return next;
}
