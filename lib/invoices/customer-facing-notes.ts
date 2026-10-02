/**
 * Customer-facing invoice / payment-document note provenance.
 *
 * Guided payment setup writes `${packageName} — booking commitment` into
 * invoice.notes for internal recovery matching. That string is system /
 * payment-setup metadata — not a venue-authored customer note, and not
 * payment instructions.
 */

const BOOKING_COMMITMENT_NOTE_RE = /\s—\sbooking commitment$/i;

/** True when notes are the guided-setup system marker (not venue-authored). */
export function isSystemBookingCommitmentNote(
  notes: string | null | undefined,
): boolean {
  const t = notes?.trim() ?? "";
  if (!t) return false;
  return BOOKING_COMMITMENT_NOTE_RE.test(t);
}

/**
 * Venue-authored note suitable for "Notes from {venue}" on a payment document.
 * Excludes empty, system booking-commitment markers, and text already shown
 * as payment instructions (avoid duplicate presentation of the same value).
 */
export function customerFacingVenueNote(input: {
  invoiceNotes: string | null | undefined;
  paymentInstructions: string | null | undefined;
}): string | null {
  const notes = input.invoiceNotes?.trim() || "";
  if (!notes) return null;
  if (isSystemBookingCommitmentNote(notes)) return null;
  const instructions = input.paymentInstructions?.trim() || "";
  if (instructions && notes === instructions) return null;
  return notes;
}

/**
 * Payment instructions shown once on the customer document.
 * Schedule notes win; invoice.notes only when they are genuine instructions
 * (not the system booking-commitment marker).
 */
export function customerFacingPaymentInstructions(input: {
  scheduleNotes: string | null | undefined;
  invoiceNotes: string | null | undefined;
}): string | null {
  const schedule = input.scheduleNotes?.trim() || "";
  if (schedule) return schedule;
  const invoice = input.invoiceNotes?.trim() || "";
  if (!invoice) return null;
  if (isSystemBookingCommitmentNote(invoice)) return null;
  return invoice;
}

/** Customer-facing venue display name (not legal entity / businessName). */
export function customerFacingVenueDisplayName(venue: {
  name: string | null | undefined;
  businessName?: string | null | undefined;
}): string {
  const display = venue.name?.trim();
  if (display) return display;
  return venue.businessName?.trim() || "your venue";
}
