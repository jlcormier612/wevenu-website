"use server";

import { revalidatePath } from "next/cache";

import { ensureCommercialCustomerForSelection } from "@/lib/booking-journey/ensure-commercial-customer";
import { setupPaymentsFromSelection } from "@/lib/booking-journey/setup-payments";
import type { SetupPaymentsResult } from "@/lib/booking-journey/setup-payments";

export async function setupPaymentsAction(input: {
  selectionId: string;
  clientId?: string;
  eventId?: string | null;
  leadId?: string;
  depositAmount?: number;
  requestDeposit?: boolean;
}): Promise<SetupPaymentsResult> {
  let clientId = input.clientId;
  let eventId = input.eventId ?? null;

  if (!clientId) {
    const ensured = await ensureCommercialCustomerForSelection({
      selectionId: input.selectionId,
      leadId: input.leadId,
    });
    if (!ensured.ok) return ensured;
    clientId = ensured.clientId;
    eventId = ensured.eventId;
  }

  const result = await setupPaymentsFromSelection({
    selectionId: input.selectionId,
    clientId,
    eventId: eventId ?? "",
    depositAmount: input.depositAmount,
    requestDeposit: input.requestDeposit,
  });
  if (result.ok) {
    revalidatePath(`/invoices/${result.invoiceId}`);
    revalidatePath(`/payments/${result.scheduleId}`);
    revalidatePath(`/clients/${clientId}`);
    if (eventId) revalidatePath(`/events/${eventId}`);
    if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
  }
  return result;
}
