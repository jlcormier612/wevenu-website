"use server";

import { revalidatePath } from "next/cache";

import { ensureCommercialCustomerForSelection } from "@/lib/booking-journey/ensure-commercial-customer";
import { setupPaymentsFromSelection } from "@/lib/booking-journey/setup-payments";
import type { SetupPaymentsResult } from "@/lib/booking-journey/setup-payments";
import type { CustomScheduleTemplate } from "@/lib/payments/custom-default-schedule";

export async function setupPaymentsAction(input: {
  selectionId: string;
  clientId?: string;
  eventId?: string | null;
  eventDate?: string | null;
  remainingDueDate?: string | null;
  leadId?: string;
  spaceId?: string;
  depositAmount?: number;
  requestDeposit?: boolean;
  scheduleStructure?: string | null;
  customSchedule?: CustomScheduleTemplate | null;
  builderLines?: {
    label: string;
    amount: number;
    dueDate: string;
    obligationKind: import("@/lib/payments/types").PaymentObligationKind;
  }[] | null;
}): Promise<SetupPaymentsResult & { emailSent?: boolean }> {
  let clientId = input.clientId;
  let eventId = input.eventId ?? null;

  if (!clientId) {
    const ensured = await ensureCommercialCustomerForSelection({
      selectionId: input.selectionId,
      leadId: input.leadId,
      spaceId: input.spaceId,
    });
    if (!ensured.ok) return ensured;
    clientId = ensured.clientId;
    eventId = ensured.eventId;
  }

  const result = await setupPaymentsFromSelection({
    selectionId: input.selectionId,
    clientId,
    eventId: eventId ?? "",
    eventDate: input.eventDate,
    remainingDueDate: input.remainingDueDate,
    depositAmount: input.depositAmount,
    requestDeposit: input.requestDeposit,
    scheduleStructure: input.scheduleStructure,
    customSchedule: input.customSchedule,
    builderLines: input.builderLines,
  });
  if (!result.ok) return result;

  let emailSent = false;

  revalidatePath(`/invoices/${result.invoiceId}`);
  revalidatePath(`/payments/${result.scheduleId}`);
  revalidatePath(`/clients/${clientId}`);
  if (eventId) revalidatePath(`/events/${eventId}`);
  if (input.leadId) revalidatePath(`/leads/${input.leadId}`);

  return { ...result, emailSent };
}

/**
 * @deprecated Silent one-click deposit recording is removed.
 * Overview “Record deposit received” opens RecordOfflinePaymentDialog →
 * recordOfflineInstallmentPaymentAction. Kept as a hard refuse so no caller
 * can recreate a payment without the shared entry form.
 */
export async function recordDepositReceivedAction(_input: {
  clientId: string;
  amount?: number;
  paidDate?: string;
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
  leadId?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return {
    ok: false,
    message:
      "Choose the installment, amount, method, and date before recording a payment.",
  };
}
