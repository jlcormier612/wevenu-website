import { remainingAmount, roundMoney } from "@/lib/commercial-selections/constants";
import { getSelectedPackage, linkSelectionInvoice } from "@/lib/commercial-selections/service";
import { createInvoice, addLineItem as addInvoiceLine, updateInvoiceStatus } from "@/lib/invoices/service";
import { createPaymentSchedule, addLineItem } from "@/lib/payments/service";

export type SetupPaymentsResult =
  | { ok: true; invoiceId: string; scheduleId: string }
  | { ok: false; message: string };

/**
 * Guided Booking Journey payment setup:
 * one commitment invoice from Selected Package + deposit/remaining schedule.
 */
export async function setupPaymentsFromSelection(input: {
  selectionId: string;
  clientId: string;
  eventId: string;
  depositAmount?: number;
  requestDeposit?: boolean;
}): Promise<SetupPaymentsResult> {
  const selection = await getSelectedPackage(input.selectionId);
  if (!selection || selection.status === "superseded") {
    return { ok: false, message: "Selected package not found." };
  }
  if (selection.invoiceId) {
    return {
      ok: false,
      message: "Payments are already set up for this selected package. Open the existing invoice instead.",
    };
  }

  const total = roundMoney(selection.totalAmount);
  const deposit = roundMoney(
    input.depositAmount != null ? input.depositAmount : selection.depositAmount,
  );
  if (!(total > 0)) return { ok: false, message: "Package total must be greater than zero." };
  if (!(deposit >= 0) || deposit > total) {
    return { ok: false, message: "Enter a valid deposit amount." };
  }
  const remaining = remainingAmount(total, deposit);

  const invoiceResult = await createInvoice({
    clientId: input.clientId,
    eventId: input.eventId,
    notes: `${selection.name} — booking commitment`,
    dueDate: "",
  });
  if (!invoiceResult.ok) {
    return { ok: false, message: invoiceResult.message ?? "Could not create the invoice." };
  }

  const lineResult = await addInvoiceLine(invoiceResult.invoiceId, {
    type: "package",
    description: selection.name,
    quantity: "1",
    unitPrice: String(total),
    packageId: selection.sourcePackageId ?? "",
  });
  if (!lineResult.ok) {
    return { ok: false, message: lineResult.message ?? "Could not add the package line." };
  }

  const scheduleResult = await createPaymentSchedule(
    {
      title: `${selection.name} payments`,
      invoiceId: invoiceResult.invoiceId,
      notes: "",
    },
    "custom",
  );
  if (!scheduleResult.ok) {
    return { ok: false, message: scheduleResult.message ?? "Could not create the payment schedule." };
  }

  const depositLine = await addLineItem(scheduleResult.scheduleId, {
    label: "Deposit",
    amount: String(deposit),
    dueDate: "",
    obligationKind: "deposit",
  });
  if (!depositLine.ok) {
    return { ok: false, message: depositLine.message ?? "Could not add the deposit." };
  }

  if (remaining > 0) {
    const remainingLine = await addLineItem(scheduleResult.scheduleId, {
      label: "Remaining balance",
      amount: String(remaining),
      dueDate: "",
      obligationKind: "final",
    });
    if (!remainingLine.ok) {
      return { ok: false, message: remainingLine.message ?? "Could not add the remaining balance." };
    }
  }

  await linkSelectionInvoice(selection.id, invoiceResult.invoiceId);

  if (input.requestDeposit) {
    await updateInvoiceStatus(invoiceResult.invoiceId, "sent").catch(() => {
      /* create succeeded; status update is best-effort */
    });
  }

  return {
    ok: true,
    invoiceId: invoiceResult.invoiceId,
    scheduleId: scheduleResult.scheduleId,
  };
}
