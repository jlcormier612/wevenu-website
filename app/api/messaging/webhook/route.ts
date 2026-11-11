/**
 * POST /api/messaging/webhook
 *
 * Handles Resend delivery and engagement webhooks.
 * Resend signs webhooks with Svix; we verify the signature with HMAC-SHA256
 * using the RESEND_WEBHOOK_SECRET env var.
 *
 * Event types handled:
 *   email.sent           → status = 'accepted'  (provider took it — not delivered)
 *   email.delivered      → status = 'delivered', sets delivered_at
 *   email.opened         → status = 'opened',  logs a lead engagement signal
 *   email.clicked        → status = 'clicked', logs a lead engagement signal
 *   email.delivery_delayed → no status change, logged to the event history
 *   email.bounced        → status = 'failed', plain-language failure_reason
 *   email.complained     → logged to the event history (spam complaint)
 *
 * Communication Trust Experience — a message sent through the newer
 * Conversation system (conversation_messages) now carries the same
 * provider_id as a legacy one, so this single route updates whichever
 * table actually sent it rather than assuming `messages`. Status only ever
 * moves forward (see lib/communication/status.ts) — a redelivered or
 * out-of-order webhook can never erase a status the venue already saw.
 *
 * Configure in Resend Dashboard → Webhooks → Add Endpoint → point to this URL.
 */

import { type NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { applyResendDeliveryEvent, type ResendDeliveryPayload } from "@/lib/messaging/apply-resend-delivery";
import { verifyResendWebhookSecrets } from "@/lib/resend/inbound-webhook";

export async function POST(request: NextRequest) {
  const body = await request.text();

  // Same Svix verification as inbound (whsec_ base64 decode + comma-separated
  // secrets). The previous local HMAC used the raw whsec_ string as the key,
  // which can never match Resend's signatures once RESEND_WEBHOOK_SECRET is set.
  if (!verifyResendWebhookSecrets(body, {
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
  })) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: ResendDeliveryPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!payload.data?.email_id) return NextResponse.json({ ok: true });

  try {
    // TR-M7: webhook call, no Supabase session — the anon/cookie client's
    // reads and writes were silently rejected by RLS here.
    const supabase = createAdminClient();
    await applyResendDeliveryEvent(supabase as never, payload);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Messaging webhook error:", err);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}
