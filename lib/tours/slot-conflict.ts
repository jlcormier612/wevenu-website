/** Conflict messages from book/reschedule RPC mapping + capacity write refusals. */
export function isTourSlotConflictError(error: string): boolean {
  const e = error.toLowerCase();
  return (
    e.includes("no longer available")
    || e.includes("just booked")
    || e.includes("choose another time")
    || e.includes("slot was just booked")
  );
}
