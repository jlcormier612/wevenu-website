/**
 * Stripe Connect webhook event handlers — Sprint 4, Venue Payment
 * Processing. Called from app/api/webhooks/stripe-connect/route.ts after
 * signature verification and the top-level stripe_webhook_events
 * idempotency gate.
 *
 * Runs under createAdminClient() (service_role, no user session — Stripe
 * calls this route, there is no coordinator or couple session to resolve
 * venue/client from). This is why it calls lib/payments/repository.ts
 * functions directly with the admin client rather than lib/payments/
 * service.ts's markLineItemPaid()/refundLineItem_(), which are hard-wired
 * to session-based venue resolution (getCurrentVenue()) and can't run in
 * a webhook context. It replicates the same side-effect list those
 * functions have for a manual "Mark Paid" click — payment_activities,
 * QuickBooks sync enqueue, invoice balance reconciliation, the Planning
 * auto-complete hook, and the final-payment Luv celebration — plus one
 * new side effect neither manual path has yet: a Conversation receipt
 * message (docs/venue-payment-processing-architecture.md §6 decision 4).
 *
 * Deliberately NOT called here: recordEngagementEvent() — it resolves its
 * Supabase client from request cookies (lib/activation/service.ts), which
 * don't exist in a webhook request. Calling it would silently do nothing
 * useful; skipped rather than built as a parallel, unverified variant.
 * Documented gap, not an oversight — see the Sprint 4 final report.
 */
import type Stripe from "stripe";

import { createAdminClient } from "@/integrations/supabase/admin";
import * as paymentsRepo from "@/lib/payments/repository";
import {
  celebrateFinalPaymentObligationIfNeeded,
  completeFinalPaymentTasksBoundToLine,
} from "@/lib/payments/final-payment-obligation";
import { triggerAutoComplete } from "@/lib/playbooks/service";
import { cancelRemindersForPaymentLineItem } from "@/lib/notifications/obligations";
import { computePaymentsReadiness } from "@/lib/readiness/compute";
import { enqueueQuickBooksSync } from "@/lib/quickbooks/queue";
import { postPaymentFailedMessage, postPaymentReceivedReceipt } from "@/lib/stripe/notify";
import type { Invoice } from "@/lib/invoices/types";
import type { PaymentObligationKind } from "@/lib/payments/types";
import {
  abandonTourProtectionFromWebhook,
  completeProtectedTourFromWebhook,
  failTourProtectionFromWebhook,
  markTourProtectionRefundedFromStripe,
  tourProtectionRequestExists,
} from "@/lib/tours/protection";
import { isTourProtectionMetadata } from "@/lib/tours/protection-rules";

type PiMetadata = {
  htc_payment_line_item_id?: string;
  htc_venue_id?: string;
  htc_client_id?: string;
  htc_schedule_id?: string;
  htc_kind?: string;
  htc_tour_protection_request_id?: string;
  // Legacy keys — still accepted for PaymentIntents created before brand cleanup.
  wevenu_payment_line_item_id?: string;
  wevenu_venue_id?: string;
  wevenu_client_id?: string;
  wevenu_schedule_id?: string;
};

function paymentMeta(meta: PiMetadata) {
  return {
    itemId: meta.htc_payment_line_item_id ?? meta.wevenu_payment_line_item_id,
    venueId: meta.htc_venue_id ?? meta.wevenu_venue_id,
    clientId: meta.htc_client_id ?? meta.wevenu_client_id,
    scheduleId: meta.htc_schedule_id ?? meta.wevenu_schedule_id,
  };
}

function paymentMethodTypeFrom(pi: Stripe.PaymentIntent): "card" | "us_bank_account" {
  const type = pi.payment_method_types?.[0];
  return type === "us_bank_account" ? "us_bank_account" : "card";
}

/**
 * payment_intent.succeeded — the one canonical "funds are guaranteed"
 * signal, used for both card (fires almost immediately) and ACH (fires
 * once the debit actually settles, days later). An invoice is never
 * marked paid before this fires.
 */
export async function handlePaymentIntentSucceeded(
  pi: Stripe.PaymentIntent,
  connectedAccountVenueId: string | null,
): Promise<void> {
  const meta = pi.metadata as PiMetadata;
  const { itemId, venueId, clientId, scheduleId } = paymentMeta(meta);

  if (itemId || isTourProtectionMetadata(meta)) {
    const handled = await completeProtectedTourFromWebhook({
      requestId: meta.htc_tour_protection_request_id ?? itemId ?? null,
      connectedAccountVenueId,
      metadataVenueId: venueId ?? null,
      stripePaymentIntentId: pi.id,
      stripePaymentMethodId: typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id ?? null,
      stripeCustomerId: typeof pi.customer === "string" ? pi.customer : pi.customer?.id ?? null,
    });
    if (handled === "handled") return;
  }

  if (!itemId || !venueId || !scheduleId) return; // not one of ours (or malformed) — nothing to do

  const admin = createAdminClient();
  const method = paymentMethodTypeFrom(pi);
  const paidAmount = pi.amount_received / 100;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const marked = await paymentsRepo.markItemPaidFromStripe(admin as any, venueId, itemId, {
    paidAmount, stripePaymentIntentId: pi.id, stripePaymentMethodType: method,
  });
  if (!marked.ok) { console.error(`[stripe webhook] markItemPaidFromStripe failed for ${itemId}`, marked.message); return; }
  if (marked.alreadyPaid) return; // idempotent redelivery — everything below already ran once

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await cancelRemindersForPaymentLineItem(admin as any, venueId, itemId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await paymentsRepo.insertPaymentActivity(admin as any, venueId, scheduleId, "payment_received",
    `Payment received: $${paidAmount.toLocaleString()}`, `Via Stripe (${method === "us_bank_account" ? "ACH" : "card"})`);

  void enqueueQuickBooksSync(venueId, "payment", itemId, { paidAmount });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sch } = await (admin as any).from("payment_schedules")
    .select("invoice_id, event_id").eq("id", scheduleId).maybeSingle();
  const invoiceId = sch?.invoice_id as string | null | undefined;
  const eventId = sch?.event_id as string | null | undefined;

  if (invoiceId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await paymentsRepo.reconcileInvoiceBalance(admin as any, venueId, invoiceId);
  }
  if (eventId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await triggerAutoComplete(admin as any, venueId, eventId, "payment_received", "payment", itemId);
    // Option B: complete only Final Payment tasks bound to THIS line.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await completeFinalPaymentTasksBoundToLine(admin as any, venueId, itemId);
  }

  {
    const { emitPlatformEventWithClient } = await import("@/lib/platform-events/service");
    await emitPlatformEventWithClient(admin, {
      eventType: "Payment.Received",
      sourceFeature: "payments",
      entityType: "payment_line_item",
      entityId: itemId,
      venueId,
      clientId: clientId ?? null,
      actor: { type: "client", id: clientId ?? null, name: null },
      payload: { scheduleId, eventId: eventId ?? null, source: "stripe" },
    });
  }

  // Final Payment obligation Luv (Impl 7) — distinct from paid-in-full below.
  if (eventId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: paidLine } = await (admin as any).from("payment_line_items")
      .select("obligation_kind").eq("id", itemId).eq("venue_id", venueId).maybeSingle();
    await celebrateFinalPaymentObligationIfNeeded(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      admin as any,
      venueId,
      eventId,
      itemId,
      (paidLine?.obligation_kind as PaymentObligationKind | null) ?? null,
    );
  }

  // Final Payment Received — same guard shape as markLineItemPaid: reads
  // computePaymentsReadiness's own "complete" status, insert-only (the
  // luv_celebrations unique constraint is the real "first time" check).
  if (eventId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: eventInvoices } = await (admin as any).from("invoices").select("*").eq("venue_id", venueId).eq("event_id", eventId);
    const invoices = (eventInvoices ?? []) as unknown as Invoice[];
    if (invoices.length > 0 && computePaymentsReadiness(invoices).status === "complete") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ev } = await (admin as any).from("events").select("client_id").eq("id", eventId).maybeSingle();
      if (ev?.client_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from("luv_celebrations")
          .insert({ venue_id: venueId, client_id: ev.client_id, event_id: eventId, celebration_type: "final_payment_received", entity_id: invoiceId });
      }
    }
  }

  if (clientId) {
    await postPaymentReceivedReceipt(admin, venueId, clientId, scheduleId, paidAmount, method);
  }
}

/** payment_intent.processing — ACH only. Debit initiated, not yet settled. */
export async function handlePaymentIntentProcessing(
  pi: Stripe.PaymentIntent,
): Promise<void> {
  const meta = pi.metadata as PiMetadata;
  const { itemId, venueId } = paymentMeta(meta);
  const requestId = meta.htc_tour_protection_request_id ?? itemId ?? null;
  if (requestId && await tourProtectionRequestExists(requestId)) return;
  if (!itemId || !venueId) return;

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await paymentsRepo.markItemProcessing(admin as any, venueId, itemId, {
    stripePaymentIntentId: pi.id, stripePaymentMethodType: paymentMethodTypeFrom(pi),
  });
}

/** payment_intent.payment_failed — an immediate card decline, or an ACH debit that failed after initiating (e.g. insufficient funds). Reverts to pending — nothing was actually collected. */
export async function handlePaymentIntentFailed(
  pi: Stripe.PaymentIntent,
  connectedAccountVenueId: string | null,
): Promise<void> {
  const meta = pi.metadata as PiMetadata;
  const { itemId, venueId, clientId } = paymentMeta(meta);
  if (itemId || isTourProtectionMetadata(meta)) {
    const handled = await failTourProtectionFromWebhook({
      requestId: meta.htc_tour_protection_request_id ?? itemId ?? null,
      connectedAccountVenueId,
    });
    if (handled === "handled") return;
  }
  if (!itemId || !venueId) return;

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item } = await (admin as any).from("payment_line_items").select("label, status").eq("id", itemId).eq("venue_id", venueId).maybeSingle();
  if (!item || item.status !== "processing") return; // a failed card auth that never left 'pending' — nothing to revert

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await paymentsRepo.revertItemToPending(admin as any, venueId, itemId);

  if (clientId) {
    const reason = pi.last_payment_error?.message ?? null;
    await postPaymentFailedMessage(admin, venueId, clientId, item.label as string, reason);
  }
}

/** charge.refunded — confirms a refund Hello to Cheers already initiated (lib/payments/service.ts's refundLineItem_ calls Stripe synchronously; this is a defensive, idempotent confirmation, not the primary trigger). */
export async function handleChargeRefunded(
  charge: Stripe.Charge,
  connectedAccountVenueId: string | null,
): Promise<void> {
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const tourHandled = await markTourProtectionRefundedFromStripe(paymentIntentId, connectedAccountVenueId);
  if (tourHandled === "handled") return;

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item } = await (admin as any).from("payment_line_items")
    .select("id, venue_id, status, amount, paid_amount, refunded_amount")
    .eq("stripe_payment_intent_id", paymentIntentId).maybeSingle();
  if (!item) return; // not one of ours
  if (item.status === "refunded") return; // already finalized locally — idempotent no-op

  // The synchronous refund path (lib/payments/service.ts's refundLineItem_)
  // already updates the ledger on a successful stripe.refunds.create()
  // call. If this event arrives and the item is still 'paid' (meaning the
  // synchronous path hasn't run — e.g. a refund issued directly in the
  // Stripe Dashboard rather than through Hello to Cheers), reconcile it here so the
  // ledger doesn't silently drift from what Stripe actually did.
  if (item.status !== "paid" && item.status !== "partially_refunded") return;

  const refundedAmount = charge.amount_refunded / 100;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outcome = await paymentsRepo.refundLineItem(admin as any, item.venue_id, item.id, refundedAmount - Number(item.refunded_amount ?? 0));
  if (!outcome.ok) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sch } = await (admin as any).from("payment_line_items").select("schedule_id").eq("id", item.id).maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: schedule } = await (admin as any).from("payment_schedules").select("invoice_id").eq("id", sch?.schedule_id).maybeSingle();
  if (schedule?.invoice_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await paymentsRepo.reconcileInvoiceBalance(admin as any, item.venue_id, schedule.invoice_id);
  }
}

function setupIntentIdFrom(session: Stripe.Checkout.Session): string | null {
  if (typeof session.setup_intent === "string") return session.setup_intent;
  return session.setup_intent?.id ?? null;
}

function paymentIntentIdFrom(session: Stripe.Checkout.Session): string | null {
  if (typeof session.payment_intent === "string") return session.payment_intent;
  return session.payment_intent?.id ?? null;
}

function paymentMethodIdFrom(session: Stripe.Checkout.Session): string | null {
  const setup = typeof session.setup_intent === "object" ? session.setup_intent : null;
  if (setup && typeof setup.payment_method === "string") return setup.payment_method;
  if (setup && setup.payment_method && typeof setup.payment_method === "object") {
    return setup.payment_method.id;
  }
  return null;
}

/**
 * checkout.session.completed — authoritative for Setup mode (no payment_intent)
 * and a second success signal for fee mode. book_protected_tour is idempotent.
 */
export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  connectedAccountVenueId: string | null,
): Promise<void> {
  const meta = (session.metadata ?? {}) as PiMetadata;
  if (session.mode === "payment" && session.payment_status !== "paid") return;
  if (session.mode === "setup" && session.status !== "complete") return;

  await completeProtectedTourFromWebhook({
    requestId: meta.htc_tour_protection_request_id ?? meta.htc_payment_line_item_id ?? null,
    checkoutSessionId: session.id,
    connectedAccountVenueId,
    metadataVenueId: meta.htc_venue_id ?? meta.wevenu_venue_id ?? null,
    stripePaymentIntentId: paymentIntentIdFrom(session),
    stripeSetupIntentId: setupIntentIdFrom(session),
    stripePaymentMethodId: paymentMethodIdFrom(session),
    stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
  });
}

export async function handleCheckoutSessionExpired(
  session: Stripe.Checkout.Session,
  connectedAccountVenueId: string | null,
): Promise<void> {
  await abandonTourProtectionFromWebhook({
    checkoutSessionId: session.id,
    connectedAccountVenueId,
  });
}
