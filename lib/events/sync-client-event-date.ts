/**
 * Client list / workspace surfaces still read clients.event_date.
 * Once an Event exists it is the sole canonical writer for that date
 * (see updateClientInfo defense-in-depth). This helper decides when an
 * event-date mutation must write the synchronized client copy.
 *
 * Rule:
 * - Mirror the edited event's start/end onto its linked client when the
 *   event is the relationship's authoritative active event (has client_id
 *   and is not cancelled).
 * - Do not sync cancelled events (date edits must not rewrite the client's
 *   working date or reactivate cancelled relationships).
 * - Do not invent multi-event priority: the product treats one active
 *   event per client as the operational unit (getEventIdForClient).
 * - Never touch sales_stage, booked_at, client status, contract, or payment.
 */

export type ClientEventDateSyncInput = {
  clientId: string | null | undefined;
  eventStatus: string | null | undefined;
  previousEventDate: string | null | undefined;
  previousEventEndDate: string | null | undefined;
  nextEventDate: string;
  nextEventEndDate: string | null;
};

export type ClientEventDateSyncPatch = {
  clientId: string;
  eventDate: string;
  endDate: string | null;
};

export function clientEventDateSyncPatch(
  input: ClientEventDateSyncInput,
): ClientEventDateSyncPatch | null {
  const clientId = input.clientId?.trim() || null;
  if (!clientId) return null;
  if (input.eventStatus === "cancelled") return null;

  const dateChanged =
    input.previousEventDate !== input.nextEventDate
    || (input.previousEventEndDate ?? null) !== (input.nextEventEndDate ?? null);
  if (!dateChanged) return null;

  return {
    clientId,
    eventDate: input.nextEventDate,
    endDate: input.nextEventEndDate,
  };
}
