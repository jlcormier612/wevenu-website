/**
 * Stripe Connect webhook — receives events from every venue's connected
 * account (not Wevenu's own account). Sprint 4, Venue Payment Processing.
 *
 * Structural idiom matches app/api/facebook/webhook/route.ts: read the raw
 * body via request.text() before any parsing, verify, then dispatch.
 * Verification itself uses Stripe's own SDK (constructEvent), not
 * hand-rolled HMAC.
 *
 * Idempotency: an insert-first, unique-constraint gate on the Stripe event
 * id (stripe_webhook_events) covers the entire handler, not just the
 * balance update — a duplicate delivery never re-runs the Conversation-
 * message or QuickBooks-enqueue side effects a second time. This is on
 * top of (not instead of) the per-entity idempotency already built into
 * markItemPaidFromStripe/markItemProcessing themselves.
 */
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { createAdminClient } from "@/integrations/supabase/admin";
import { getStripeClient, isStripeWebhookConfigured } from "@/lib/stripe/config";
import {
  handleChargeRefunded,
  handlePaymentIntentFailed,
  handlePaymentIntentProcessing,
  handlePaymentIntentSucceeded,
} from "@/lib/stripe/webhook-handlers";

export async function POST(request: Request) {
  if (!isStripeWebhookConfigured()) {
    return NextResponse.json({ error: "Stripe webhooks not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency gate for the whole handler — a unique-violation here means
  // this exact event was already fully processed; return 200 immediately
  // without re-running anything.
  const connectedAccountId = (event as unknown as { account?: string }).account ?? null;
  let venueId: string | null = null;
  if (connectedAccountId) {
    const { data: venue } = await admin.from("venues").select("id").eq("stripe_account_id", connectedAccountId).maybeSingle<{ id: string }>();
    venueId = venue?.id ?? null;
  }

  const { error: dedupeError } = await admin.from("stripe_webhook_events")
    .insert({ stripe_event_id: event.id, event_type: event.type, venue_id: venueId });
  if (dedupeError) {
    // 23505 = unique_violation — a genuine redelivery. Any other error is
    // a real problem; return non-2xx so Stripe retries (Stripe's own
    // retry schedule is the retry mechanism here — see architecture doc §4.4).
    if (dedupeError.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    console.error("[stripe webhook] idempotency insert failed", dedupeError);
    return NextResponse.json({ error: "Could not record webhook event." }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.processing":
        await handlePaymentIntentProcessing(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        // Not an event type we act on — still a valid, successfully
        // recorded delivery.
        break;
    }
  } catch (err) {
    console.error(`[stripe webhook] handler failed for ${event.type}`, err);
    // Remove the idempotency row so Stripe's retry isn't swallowed as a
    // false "duplicate" — the insert above claims the event to guard
    // against a concurrent double-delivery mid-processing, but a failed
    // attempt is not a completed one and must not block a genuine retry.
    // The per-entity status guards inside each handler make a retry safe
    // even after a partial success within this same attempt.
    await admin.from("stripe_webhook_events").delete().eq("stripe_event_id", event.id);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
