/**
 * Pure helpers for invoice-linked QuickBooks refund reconciliation.
 *
 * HTC refunds accumulate on payment_line_items.refunded_amount. QuickBooks
 * must show the same net collection on the existing Payment:
 *   applied = paid_amount − refunded_amount
 * Partial refunds update that Payment; a full refund voids it. RefundReceipt
 * is not used for invoice-linked payments.
 */

export type QboPaymentLine = {
  Amount?: number;
  LinkedTxn?: Array<{ TxnId?: string; TxnType?: string }>;
};

export type QboPayment = {
  Id?: string;
  SyncToken?: string;
  TotalAmt?: number;
  UnappliedAmt?: number;
  PrivateNote?: string | null;
  CustomerRef?: { value?: string; name?: string };
  DepositToAccountRef?: { value?: string; name?: string };
  PaymentRefNum?: string | null;
  PaymentMethodRef?: { value?: string; name?: string };
  TxnDate?: string;
  Line?: QboPaymentLine[];
};

const MONEY_EPS = 0.001;

export function moneyEquals(a: number, b: number): boolean {
  return Math.abs(a - b) < MONEY_EPS;
}

/** Net retained collection still applied against the invoice after refunds. */
export function computeNetRetained(paidAmount: number, refundedAmount: number): number {
  return Math.max(0, Number(paidAmount) - Number(refundedAmount));
}

export function invoiceAppliedAmount(payment: QboPayment, invoiceQuickBooksId: string): number {
  let applied = 0;
  for (const line of payment.Line ?? []) {
    const linksInvoice = (line.LinkedTxn ?? []).some(
      (lt) => lt.TxnType === "Invoice" && String(lt.TxnId) === String(invoiceQuickBooksId),
    );
    if (linksInvoice) applied += Number(line.Amount ?? 0);
  }
  return applied;
}

export function isPaymentVoided(payment: QboPayment): boolean {
  const total = Number(payment.TotalAmt ?? 0);
  const lines = payment.Line ?? [];
  const note = payment.PrivateNote ?? "";
  if (/^voided\b/i.test(note.trim()) || /\bvoided\b/i.test(note)) {
    if (moneyEquals(total, 0) && lines.length === 0) return true;
  }
  return moneyEquals(total, 0) && lines.length === 0;
}

/**
 * Whether the remote Payment already reflects the desired net-retained target.
 * Target 0 means fully refunded → voided (or zeroed) Payment.
 */
export function paymentMatchesTarget(
  payment: QboPayment,
  target: number,
  invoiceQuickBooksId: string,
): boolean {
  if (target <= MONEY_EPS) {
    return isPaymentVoided(payment) || (
      moneyEquals(Number(payment.TotalAmt ?? 0), 0)
      && moneyEquals(invoiceAppliedAmount(payment, invoiceQuickBooksId), 0)
    );
  }
  if (!moneyEquals(Number(payment.TotalAmt ?? 0), target)) return false;
  if (!moneyEquals(invoiceAppliedAmount(payment, invoiceQuickBooksId), target)) return false;
  // Unapplied remainder would mean we reduced the line without reducing TotalAmt.
  if (payment.UnappliedAmt != null && !moneyEquals(Number(payment.UnappliedAmt), 0)) return false;
  return true;
}

export function isStaleSyncTokenError(error: string): boolean {
  const lower = error.toLowerCase();
  return (
    lower.includes("stale object")
    || lower.includes("synctoken")
    || lower.includes("error code\": \"5010\"")
    || lower.includes('"code":"5010"')
    || lower.includes("code\": \"5010\"")
  );
}

/** Build a full Payment update body so omitted writable fields are not NULLed. */
export function buildPaymentReconcileUpdateBody(
  payment: QboPayment,
  target: number,
  invoiceQuickBooksId: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    Id: payment.Id,
    SyncToken: payment.SyncToken,
    sparse: false,
    TotalAmt: target,
    CustomerRef: { value: payment.CustomerRef?.value },
    Line: [{
      Amount: target,
      LinkedTxn: [{ TxnId: invoiceQuickBooksId, TxnType: "Invoice" }],
    }],
  };
  if (payment.DepositToAccountRef?.value) {
    body.DepositToAccountRef = { value: payment.DepositToAccountRef.value };
  }
  if (payment.PaymentRefNum != null && payment.PaymentRefNum !== "") {
    body.PaymentRefNum = payment.PaymentRefNum;
  }
  if (payment.PrivateNote != null && payment.PrivateNote !== "") {
    body.PrivateNote = payment.PrivateNote;
  }
  if (payment.PaymentMethodRef?.value) {
    body.PaymentMethodRef = { value: payment.PaymentMethodRef.value };
  }
  if (payment.TxnDate) {
    body.TxnDate = payment.TxnDate;
  }
  return body;
}

export function buildPaymentVoidBody(payment: QboPayment): Record<string, unknown> {
  return {
    Id: payment.Id,
    SyncToken: payment.SyncToken,
    sparse: true,
  };
}

/** Bound used for the Deposit scan — a full page is treated as potentially capped. */
export const DEPOSIT_SCAN_MAX_RESULTS = 100;

export const DEPOSIT_STATUS_UNCONFIRMED =
  "Could not confirm Bank Deposit status; no QuickBooks write was attempted.";

export type DepositScanRow = {
  Id?: string;
  Line?: Array<{ LinkedTxn?: Array<{ TxnId?: string; TxnType?: string }> }>;
};

/** Scan Deposit query rows for a LinkedTxn pointing at this Payment. */
export function depositContainsPayment(
  deposits: readonly DepositScanRow[],
  paymentId: string,
): boolean {
  for (const deposit of deposits) {
    for (const line of deposit.Line ?? []) {
      for (const lt of line.LinkedTxn ?? []) {
        if (String(lt.TxnId) === String(paymentId) && (lt.TxnType === "Payment" || !lt.TxnType)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Interpret a Deposit query payload for refund-reconcile safety.
 *
 * - found: Payment is in a Deposit → refuse write
 * - clear: complete scan (under the max page size) and Payment absent → write may proceed
 * - ambiguous: null/undefined, capped page, malformed payload, or otherwise unconfirmed → refuse write
 *
 * Callers that have already validated a successful QueryResponse envelope should
 * normalize an omitted Deposit field to [] before calling (empty array = clear).
 */
export function evaluateDepositScan(
  deposits: unknown,
  paymentId: string,
  maxResults: number = DEPOSIT_SCAN_MAX_RESULTS,
): "found" | "clear" | "ambiguous" {
  if (deposits == null) return "ambiguous";
  if (!Array.isArray(deposits)) return "ambiguous";
  if (depositContainsPayment(deposits, paymentId)) return "found";
  // A full page may omit older Deposits that still hold this Payment.
  if (deposits.length >= maxResults) return "ambiguous";
  return "clear";
}
