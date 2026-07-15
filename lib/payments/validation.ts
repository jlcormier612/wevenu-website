/**
 * Payments validation. Pure functions.
 */
import type { LineItemInput, MarkPaidInput, PaymentErrors, ScheduleInput } from "@/lib/payments/types";

export function validateScheduleInput(input: ScheduleInput): PaymentErrors {
  const errors: PaymentErrors = {};
  if (!input.title.trim()) errors.title = "Schedule title is required.";
  if (!input.invoiceId) errors.invoiceId = "A payment plan must be linked to an invoice.";
  return errors;
}

export function validateLineItemInput(input: LineItemInput): PaymentErrors {
  const errors: PaymentErrors = {};
  if (!input.label.trim()) errors.label = "Label is required.";
  if (!input.amount.trim()) {
    errors.amount = "Amount is required.";
  } else {
    const n = Number(input.amount.replace(/[$,]/g, ""));
    if (isNaN(n) || n < 0) errors.amount = "Enter a valid amount.";
  }
  return errors;
}

export function validateMarkPaidInput(input: MarkPaidInput): PaymentErrors {
  const errors: PaymentErrors = {};
  if (!input.paidAmount.trim()) {
    errors.paidAmount = "Enter the amount received.";
  } else {
    const n = Number(input.paidAmount.replace(/[$,]/g, ""));
    if (isNaN(n) || n < 0) errors.paidAmount = "Enter a valid amount.";
  }
  if (!input.paidDate) errors.paidDate = "Enter the payment date.";
  return errors;
}
