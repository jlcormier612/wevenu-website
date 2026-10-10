/**
 * Contracts list Event Date resolution.
 *
 * Prefer the linked event's date when `contracts.event_id` resolves.
 * When the contract has no event FK (common for client-first / pre-booking
 * agreements), fall back to the client's authoritative `event_date` — the
 * same precedence used by invoice list mapping and contract merge fields.
 *
 * Never invent dates from signature/created/invoice timestamps, and never
 * pick an arbitrary event among a client's many events.
 */
export function resolveContractListEventDate(
  eventDate: string | null | undefined,
  clientEventDate: string | null | undefined,
): string | null {
  const fromEvent = typeof eventDate === "string" ? eventDate.trim() : "";
  if (fromEvent) return fromEvent;
  const fromClient = typeof clientEventDate === "string" ? clientEventDate.trim() : "";
  return fromClient || null;
}
