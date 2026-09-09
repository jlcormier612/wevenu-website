"use server";

import { revalidatePath } from "next/cache";

import { sendInvoiceEmailAction } from "@/app/(app)/invoices/actions";
import { ensureCommercialCustomerForSelection } from "@/lib/booking-journey/ensure-commercial-customer";
import { setupPaymentsFromSelection } from "@/lib/booking-journey/setup-payments";
import type { SetupPaymentsResult } from "@/lib/booking-journey/setup-payments";

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
  });
  if (!result.ok) return result;

  let emailSent = false;
  if (input.requestDeposit) {
    const emailed = await sendInvoiceEmailAction(result.invoiceId);
    emailSent = emailed.ok === true;
  }

  revalidatePath(`/invoices/${result.invoiceId}`);
  revalidatePath(`/payments/${result.scheduleId}`);
  revalidatePath(`/clients/${clientId}`);
  if (eventId) revalidatePath(`/events/${eventId}`);
  if (input.leadId) revalidatePath(`/leads/${input.leadId}`);

  return { ...result, emailSent };
}
