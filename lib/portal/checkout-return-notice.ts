/**
 * Post-Checkout return handling for the couple portal Payments surface.
 *
 * Stripe Hosted Checkout redirects to `?payment=success` when Checkout
 * completes. That redirect is NOT HTC's confirmation that the line item is
 * paid — reconciliation happens only when the Connect webhook (or an
 * equivalent authoritative write) updates `payment_line_items`.
 *
 * Customer-facing notices map to authoritative ledger states:
 *   awaiting reconciliation → confirming
 *   processing (ACH intermediate) → processing
 *   paid / partially_refunded     → confirmed
 */

export type CheckoutReturnQuery = "success" | "cancelled" | null;

/** UI notice after a Checkout return. `processing` ≠ paid. */
export type CheckoutNoticeKind = "confirming" | "processing" | "confirmed" | "cancelled" | null;

/** Authoritative ledger stage for the Checkout just completed. */
export type AuthoritativeCheckoutStage = "awaiting" | "processing" | "paid";

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

function isSettledStatus(status: string): boolean {
  return status === "paid" || status === "partially_refunded";
}

function hasRecentSettledPayment(
  lineItems: readonly CheckoutNoticeLineItem[],
  nowMs: number,
  recentMs: number = 30 * 60 * 1000,
): boolean {
  return lineItems.some((i) => {
    if (!isSettledStatus(i.status) || !i.paidAt) return false;
    const paidAtMs = Date.parse(i.paidAt);
    return Number.isFinite(paidAtMs) && nowMs - paidAtMs <= recentMs;
  });
}

/**
 * Resolve the authoritative ledger stage for the Checkout the couple just
 * completed. Never treats `processing` as paid.
 */
export function resolveAuthoritativeCheckoutStage(
  lineItems: readonly CheckoutNoticeLineItem[],
  baseline: CheckoutBaseline | null,
  nowMs: number = Date.now(),
): AuthoritativeCheckoutStage {
  const paidTotal = settledPaidTotal(lineItems);

  if (baseline) {
    const target = lineItems.find((i) => i.id === baseline.itemId);
    if (target && isSettledStatus(target.status)) return "paid";
    if (paidTotal > baseline.paidTotal) return "paid";
    if (target && target.status === "processing") return "processing";
    return "awaiting";
  }

  // No Pay-now baseline (refresh, shared link, storage cleared): only treat
  // recent authoritative transitions as progress — never the redirect alone.
  if (hasRecentSettledPayment(lineItems, nowMs)) return "paid";
  if (lineItems.some((i) => i.status === "processing")) return "processing";
  return "awaiting";
}

/**
 * @deprecated Prefer resolveAuthoritativeCheckoutStage — kept as a narrow
 * paid-only predicate for callers that need "fully settled" specifically.
 */
export function hasAuthoritativePaymentConfirmation(
  lineItems: readonly CheckoutNoticeLineItem[],
  baseline: CheckoutBaseline | null,
  nowMs: number = Date.now(),
): boolean {
  return resolveAuthoritativeCheckoutStage(lineItems, baseline, nowMs) === "paid";
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
  const stage = resolveAuthoritativeCheckoutStage(lineItems, baseline, nowMs);
  if (stage === "paid") return "confirmed";
  if (stage === "processing") return "processing";
  return "confirming";
}
