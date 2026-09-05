/**
 * Post-Checkout return handling for the couple portal Payments surface.
 *
 * Stripe Hosted Checkout redirects to `?payment=success` when Checkout
 * completes. That redirect is NOT HTC's confirmation that the line item is
 * paid — reconciliation happens only when the Connect webhook (or an
 * equivalent authoritative write) updates `payment_line_items`.
 *
 * These helpers keep the UI honest: a successful redirect shows a confirming
 * / pending state until the ledger itself reflects progress.
 */

export type CheckoutReturnQuery = "success" | "cancelled" | null;

export type CheckoutNoticeKind = "confirming" | "confirmed" | "cancelled" | null;

export type CheckoutBaseline = {
  itemId: string;
  paidTotal: number;
  at: number;
};

export type CheckoutNoticeLineItem = {
  id: string;
  status: string;
  amount: number;
  paidAmount?: number | null;
  paidAt?: string | null;
};

export const CHECKOUT_BASELINE_STORAGE_KEY = "htc.portal.checkoutBaseline";

/** Settled amount HTC already counts as paid on the plan. */
export function settledPaidTotal(lineItems: readonly CheckoutNoticeLineItem[]): number {
  return lineItems
    .filter((i) => i.status === "paid" || i.status === "partially_refunded")
    .reduce((sum, i) => sum + (i.paidAmount ?? i.amount), 0);
}

export function parseCheckoutReturnQuery(paymentParam: string | null | undefined): CheckoutReturnQuery {
  if (paymentParam === "success") return "success";
  if (paymentParam === "cancelled") return "cancelled";
  return null;
}

export function readCheckoutBaseline(
  raw: string | null | undefined,
  nowMs: number = Date.now(),
  maxAgeMs: number = 60 * 60 * 1000,
): CheckoutBaseline | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CheckoutBaseline>;
    if (
      typeof parsed.itemId !== "string" ||
      !parsed.itemId ||
      typeof parsed.paidTotal !== "number" ||
      !Number.isFinite(parsed.paidTotal) ||
      typeof parsed.at !== "number"
    ) {
      return null;
    }
    if (nowMs - parsed.at > maxAgeMs || parsed.at > nowMs + 60_000) return null;
    return { itemId: parsed.itemId, paidTotal: parsed.paidTotal, at: parsed.at };
  } catch {
    return null;
  }
}

export function serializeCheckoutBaseline(baseline: CheckoutBaseline): string {
  return JSON.stringify(baseline);
}

/**
 * Whether the authoritative portal payment ledger shows confirmation
 * progress for the Checkout the couple just completed.
 */
export function hasAuthoritativePaymentConfirmation(
  lineItems: readonly CheckoutNoticeLineItem[],
  baseline: CheckoutBaseline | null,
  nowMs: number = Date.now(),
): boolean {
  const paidTotal = settledPaidTotal(lineItems);

  if (baseline) {
    const target = lineItems.find((i) => i.id === baseline.itemId);
    if (target && (target.status === "paid" || target.status === "processing" || target.status === "partially_refunded")) {
      return true;
    }
    if (paidTotal > baseline.paidTotal) return true;
    return false;
  }

  // No Pay-now baseline (refresh, shared link, storage cleared): only treat
  // recent authoritative transitions as confirmation — never the redirect alone.
  if (lineItems.some((i) => i.status === "processing")) return true;
  const recentMs = 30 * 60 * 1000;
  return lineItems.some((i) => {
    if (i.status !== "paid" && i.status !== "partially_refunded") return false;
    if (!i.paidAt) return false;
    const paidAtMs = Date.parse(i.paidAt);
    return Number.isFinite(paidAtMs) && nowMs - paidAtMs <= recentMs;
  });
}

/**
 * Map Checkout return + current ledger into the notice the Payments UI shows.
 * `lineItems === null` means the schedule has not loaded yet.
 */
export function resolveCheckoutNotice(input: {
  checkoutReturn: CheckoutReturnQuery;
  lineItems: readonly CheckoutNoticeLineItem[] | null;
  baseline: CheckoutBaseline | null;
  nowMs?: number;
}): CheckoutNoticeKind {
  const { checkoutReturn, lineItems, baseline, nowMs = Date.now() } = input;
  if (checkoutReturn === "cancelled") return "cancelled";
  if (checkoutReturn !== "success") return null;
  if (lineItems == null) return "confirming";
  if (hasAuthoritativePaymentConfirmation(lineItems, baseline, nowMs)) return "confirmed";
  return "confirming";
}
