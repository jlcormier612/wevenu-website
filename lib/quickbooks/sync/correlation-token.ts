/**
 * Deterministic, queryable correlation tokens for Payment and RefundReceipt
 * idempotency.
 *
 * PrivateNote is not queryable on either entity (Intuit ValidationFault 4001),
 * so it cannot be the lookup key. Payment.PaymentRefNum and
 * RefundReceipt.DocNumber are queryable, but both cap at 21 characters and
 * the QuickBooks query parser rejects GUID-shaped literals outright. A raw
 * payment_line_items UUID therefore cannot be used as the token.
 *
 * Shape: 4-char prefix + 12 hex chars from sha256(row id) = 16 chars,
 * under the 21-char limit, and deliberately not GUID-shaped (no dashes).
 */
import { createHash } from "node:crypto";

const TOKEN_HEX_CHARS = 12;

function tokenFor(prefix: "HTCP" | "HTCR", lineItemId: string): string {
  return (
    prefix +
    createHash("sha256").update(lineItemId).digest("hex").slice(0, TOKEN_HEX_CHARS).toUpperCase()
  );
}

/** Payment.PaymentRefNum token for a payment_line_items row. */
export function paymentCorrelationToken(lineItemId: string): string {
  return tokenFor("HTCP", lineItemId);
}

/** RefundReceipt.DocNumber token for a payment_line_items refund. */
export function refundCorrelationToken(lineItemId: string): string {
  return tokenFor("HTCR", lineItemId);
}
