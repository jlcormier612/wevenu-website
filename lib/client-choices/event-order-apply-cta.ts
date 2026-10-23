/**
 * Venue CTA copy for applying Client Choices onto the Event Order (finalize action).
 * Pure helpers — no domain writes.
 */

export function eventOrderApplyLabel(input: {
  hasEventOrder: boolean;
  eventOrderId: string | null;
  appliedLineIds: string[];
}): string {
  const updating =
    input.hasEventOrder
    || Boolean(input.eventOrderId)
    || (input.appliedLineIds?.length ?? 0) > 0;
  return updating ? "Update Event Order from selections" : "Create Event Order";
}

export function eventOrderApplyConfirmMessage(input: {
  hasEventOrder: boolean;
  eventOrderId: string | null;
  appliedLineIds: string[];
}): string {
  const updating =
    input.hasEventOrder
    || Boolean(input.eventOrderId)
    || (input.appliedLineIds?.length ?? 0) > 0;
  if (updating) {
    return [
      "Update the Event Order from these selections?",
      "",
      "• Couple-selected options become Event Order lines (included/free stay informational — not unintended charges).",
      "• Prior lines from this choices packet are replaced so you do not get duplicate selection lines.",
      "• Venue-authored fixed lines on the Event Order stay as they are.",
      "• Booking status does not change. Invoice and payment plan stay authoritative until you act separately.",
      "",
      "This does not email or share the final Event Order (that is a later step).",
    ].join("\n");
  }
  return [
    "Create the Event Order from these selections?",
    "",
    "• Opens (or attaches to) the event’s Event Order and applies the couple’s selected options as lines.",
    "• Included/free/informational options do not become unintended charges.",
    "• Booking status does not change.",
    "• This does not email or share the final Event Order (that is a later step).",
  ].join("\n");
}
