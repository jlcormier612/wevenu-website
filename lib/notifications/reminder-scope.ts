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

/**
 * The Supabase filter builder's own generics recurse if this helper is
 * generic over that builder. Keep the parameter wide so `next build`
 * can typecheck the call.
 */
export function applyReminderScope(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  scope?: ReminderScope,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  let next = query;
  if (scope?.reminderIds?.length) {
    next = query.in("id", scope.reminderIds);
  }
  if (scope?.venueId) {
    next = next.eq("venue_id", scope.venueId);
  }
  return next;
}
