/**
 * Pick the booking's payment schedule for contract materialization.
 *
 * Canonical relation is the existing payment_schedules row:
 *   event_id when the celebration already has an Event,
 *   else client_id when the plan was created before an Event exists.
 * Do not invent a second financial source.
 */

export type PaymentScheduleBookingRef = {
  eventId: string | null;
  clientId: string | null;
};

export function pickPaymentScheduleForBooking<T extends PaymentScheduleBookingRef>(
  schedules: T[],
  opts: { eventId?: string | null; clientId?: string | null },
): T | null {
  const eventId = opts.eventId?.trim() || "";
  const clientId = opts.clientId?.trim() || "";

  if (eventId) {
    const forEvent = schedules.find((s) => s.eventId === eventId);
    if (forEvent) return forEvent;
  }

  if (clientId) {
    return schedules.find((s) => s.clientId === clientId) ?? null;
  }

  return null;
}
