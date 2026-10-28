/**
 * Shared Event Order vs live Event Order consistency.
 *
 * Portal always reads the last share snapshot. Live lines may diverge after
 * reopen/edit. Invoicing freezes live lines — so a stale share can show the
 * couple Buffet while the invoice bills Plated.
 *
 * Authority by stage:
 * - Before first share: live Event Order is authoritative for venue work.
 * - After share: couple-facing Order = last share snapshot until re-share.
 * - Invoice freeze: live billable lines at send (incremental = unbilled only).
 * - Previously issued invoices: immutable freeze; never rewritten by EO edits.
 */

export type ShareLineFingerprintInput = {
  description: string;
  quantity: number;
  unitPrice: number | null;
  amount: number;
  isIncluded: boolean;
};

export const EVENT_ORDER_SHARE_STALE_INVOICE_MESSAGE =
  "The couple still sees an older shared Event Order that does not match the current lines (for example a different dinner or price). Re-share the Event Order so their view matches what you are invoicing, then try again.";

export function fingerprintShareCommitmentLines(
  lines: ReadonlyArray<ShareLineFingerprintInput>,
): string {
  const rows = lines.map((l) => ({
    d: l.description.trim().replace(/\s+/g, " ").toLowerCase(),
    q: Number(l.quantity) || 0,
    u: l.unitPrice == null ? "null" : Number(l.unitPrice).toFixed(2),
    a: Number(l.amount || 0).toFixed(2),
    i: l.isIncluded ? "1" : "0",
  }));
  rows.sort((a, b) =>
    a.d.localeCompare(b.d) || a.q - b.q || a.u.localeCompare(b.u) || a.a.localeCompare(b.a) || a.i.localeCompare(b.i),
  );
  return rows.map((r) => `${r.d}|${r.q}|${r.u}|${r.a}|${r.i}`).join("\n");
}

export function shareCommitmentContentDiffers(
  live: ReadonlyArray<ShareLineFingerprintInput>,
  snapshot: ReadonlyArray<ShareLineFingerprintInput>,
): boolean {
  return fingerprintShareCommitmentLines(live) !== fingerprintShareCommitmentLines(snapshot);
}

/**
 * Gate first/original EO invoice create or send when a prior share exists and
 * live content no longer matches that snapshot. Incremental amending invoices
 * are not blocked — they only freeze newly unbilled lines.
 */
export function invoiceBlockedWhenSharedCommitmentStale(input: {
  hasBeenShared: boolean;
  isAmendingInvoice: boolean;
  liveDiffersFromLastShare: boolean;
}): { ok: false; message: string } | null {
  if (input.isAmendingInvoice) return null;
  if (!input.hasBeenShared) return null;
  if (!input.liveDiffersFromLastShare) return null;
  return { ok: false, message: EVENT_ORDER_SHARE_STALE_INVOICE_MESSAGE };
}

/** Couple-facing: hide internal choices provenance tokens stored on notes. */
export function isInternalChoicesProvenanceNote(notes: string | null | undefined): boolean {
  if (!notes) return false;
  return /^choices:[0-9a-f-]{36}:[0-9a-f-]{36}$/i.test(notes.trim());
}

export function coupleVisibleLineNotes(notes: string | null | undefined): string | null {
  if (!notes?.trim()) return null;
  if (isInternalChoicesProvenanceNote(notes)) return null;
  return notes;
}

export function coupleVisibleLineUnit(unit: string | null | undefined): string | null {
  if (!unit?.trim()) return null;
  if (isInternalChoicesProvenanceNote(unit)) return null;
  return unit;
}
