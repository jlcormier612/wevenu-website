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
  scheduleStructure?: string | null;
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

/**
 * Record an externally received deposit against the commitment schedule.
 * Satisfies the commercial initial-payment condition without requiring Stripe.
 */
export async function recordDepositReceivedAction(input: {
  clientId: string;
  amount?: number;
  paidDate?: string;
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
  leadId?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { createClient } = await import("@/integrations/supabase/server");
  const { getCurrentVenue } = await import("@/lib/venue/service");
  const { markLineItemPaid } = await import("@/lib/payments/service");
  const { getVenueTimezone, venueToday } = await import("@/lib/venue/timezone");

  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Venue not found." };
  const supabase = await createClient();

  const { data: schedules } = await supabase
    .from("payment_schedules")
    .select("id")
    .eq("venue_id", venue.id)
    .eq("client_id", input.clientId);
  const scheduleIds = ((schedules ?? []) as { id: string }[]).map((s) => s.id);
  if (scheduleIds.length === 0) {
    return { ok: false, message: "Set up payments before recording a deposit." };
  }

  const { data: lines } = await supabase
    .from("payment_line_items")
    .select("id, schedule_id, amount, status, obligation_kind")
    .eq("venue_id", venue.id)
    .in("schedule_id", scheduleIds)
    .eq("obligation_kind", "deposit")
    .neq("status", "cancelled")
    .order("sort_order", { ascending: true })
    .limit(5);

  const deposit = ((lines ?? []) as {
    id: string;
    schedule_id: string;
    amount: number;
    status: string;
  }[]).find((l) => l.status !== "paid");

  if (!deposit) {
    return { ok: false, message: "No unpaid deposit found on this booking." };
  }

  const tz = await getVenueTimezone(supabase, venue.id);
  const paidDate = input.paidDate?.trim() || venueToday(tz);
  const paidAmount = String(input.amount ?? deposit.amount);

  const result = await markLineItemPaid(deposit.id, deposit.schedule_id, {
    paidAmount,
    paymentMethod: input.paymentMethod?.trim() || "External / check",
    referenceNumber: input.referenceNumber?.trim() || "",
    paidDate,
    notes: input.notes?.trim() || "Recorded from Booking Journey",
  });
  if (!result.ok) {
    return { ok: false, message: result.message ?? "Could not record the deposit." };
  }

  revalidatePath(`/payments/${deposit.schedule_id}`);
  revalidatePath(`/clients/${input.clientId}`);
  if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
  return { ok: true };
}
