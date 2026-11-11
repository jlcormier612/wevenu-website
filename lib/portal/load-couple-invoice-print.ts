/**
 * Load a couple-visible invoice for the portal print page (token auth).
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { resolveAmountDueNow } from "@/lib/invoices/amount-due-now";
import { getInvoice } from "@/lib/invoices/repository";
import type { InvoiceWithLineItems } from "@/lib/invoices/types";
import {
  computeCancelledPlanAmount,
  computeInvoiceBalanceDue,
  computeNetPaid,
} from "@/lib/payments/invoice-balance";
import { getSchedule } from "@/lib/payments/repository";
import type { PaymentObligationKind } from "@/lib/payments/types";
import { getVenueById } from "@/lib/venue/repository";
import type { Venue } from "@/lib/venue/types";
import { venueToday } from "@/lib/venue/timezone";

export type CoupleInvoicePrintModel = {
  invoice: InvoiceWithLineItems;
  venue: Venue;
  amountDueNow: ReturnType<typeof resolveAmountDueNow>;
  milestone: { label: string; obligationKind: PaymentObligationKind | null } | null;
  paidToDateOverride: number | null;
  cancelledPlanAmount: number;
  scheduleLines: {
    amount: number;
    dueDate: string | null;
    status: string;
    label: string;
    obligationKind: PaymentObligationKind | null;
    sortOrder: number;
  }[] | null;
  paymentInstructions: string | null;
  venuePaymentInstructions: string | null;
};

export async function loadCoupleInvoicePrint(
  token: string,
  invoiceId: string,
): Promise<CoupleInvoicePrintModel | null> {
  const admin = createAdminClient();
  const { data: rawIds } = await admin.rpc("_resolve_portal_ids", { p_token: token });
  const ids = Array.isArray(rawIds) ? rawIds[0] : rawIds;
  if (!ids?.client_id || !ids?.venue_id) return null;

  const { data: visible } = await admin
    .from("invoices")
    .select("id")
    .eq("id", invoiceId)
    .eq("venue_id", ids.venue_id)
    .eq("client_id", ids.client_id)
    .eq("is_couple_visible", true)
    .maybeSingle<{ id: string }>();
  if (!visible) return null;

  const [invoice, venue] = await Promise.all([
    getInvoice(admin as never, ids.venue_id, invoiceId),
    getVenueById(admin as never, ids.venue_id),
  ]);
  if (!invoice || !venue || invoice.clientId !== ids.client_id) return null;

  const { data: scheduleRow } = await admin
    .from("payment_schedules")
    .select("id")
    .eq("invoice_id", invoiceId)
    .eq("venue_id", ids.venue_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  const linked = scheduleRow
    ? await getSchedule(admin as never, ids.venue_id, scheduleRow.id)
    : null;

  const balanceDue = linked
    ? computeInvoiceBalanceDue(invoice.total, linked.lineItems)
    : invoice.balanceDue;
  const invoiceView = { ...invoice, balanceDue };

  const scheduleLines = linked
    ? linked.lineItems.map((i) => ({
        amount: i.amount,
        dueDate: i.dueDate,
        status: i.status,
        label: i.label,
        obligationKind: i.obligationKind,
        sortOrder: i.sortOrder,
      }))
    : null;

  const amountDueNow = resolveAmountDueNow({
    balanceDue,
    scheduleLines,
    today: venueToday(venue.timezone),
  });

  const nextOpen =
    amountDueNow.kind === "next_installment"
      ? linked?.lineItems.find(
          (i) =>
            i.amount === amountDueNow.amount
            && i.label === (amountDueNow.label ?? i.label)
            && (i.status === "pending" || i.status === "overdue" || i.status === "processing" || i.status === "partially_paid"),
        ) ?? null
      : null;

  return {
    invoice: invoiceView,
    venue,
    amountDueNow,
    milestone: nextOpen
      ? { label: nextOpen.label, obligationKind: nextOpen.obligationKind ?? null }
      : null,
    paidToDateOverride: linked ? computeNetPaid(linked.lineItems) : null,
    cancelledPlanAmount: linked ? computeCancelledPlanAmount(linked.lineItems) : 0,
    scheduleLines,
    paymentInstructions: linked?.notes ?? invoiceView.notes,
    venuePaymentInstructions:
      venue.commercialBookingPrefs?.clientPaymentInstructions ?? null,
  };
}
