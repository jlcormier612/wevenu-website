"use server";

import { revalidatePath } from "next/cache";

import { setupPaymentsFromSelection } from "@/lib/booking-journey/setup-payments";
import type { SetupPaymentsResult } from "@/lib/booking-journey/setup-payments";

export async function setupPaymentsAction(input: {
  selectionId: string;
  clientId: string;
  eventId: string;
  depositAmount?: number;
  requestDeposit?: boolean;
}): Promise<SetupPaymentsResult> {
  const result = await setupPaymentsFromSelection(input);
  if (result.ok) {
    revalidatePath(`/invoices/${result.invoiceId}`);
    revalidatePath(`/payments/${result.scheduleId}`);
    revalidatePath(`/clients/${input.clientId}`);
    revalidatePath(`/events/${input.eventId}`);
  }
  return result;
}
