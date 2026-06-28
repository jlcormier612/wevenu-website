/**
 * POST /api/messaging/webhook
 *
 * Handles Resend delivery and engagement webhooks.
 * Resend signs webhooks with Svix; we verify the signature with HMAC-SHA256
 * using the RESEND_WEBHOOK_SECRET env var.
 *
 * Event types handled:
 *   email.sent           → status = 'sent'
 *   email.delivered      → status = 'delivered', sets delivered_at
 *   email.delivery_delayed → no status change, logged to message_events
 *   email.bounced        → status = 'failed', logs bounce
 *   email.complained     → logged to message_events (spam complaint)
 *
 * Configure in Resend Dashboard → Webhooks → Add Endpoint → point to this URL.
 */

import { createHmac } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/integrations/supabase/server";

type ResendWebhookPayload = {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject?: string;
    bounced_at?: string;
    created_at?: string;
  };
};

function verifySignature(body: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true; // Skip verification in development

  const svixId = headers.get("svix-id") ?? "";
  const svixTimestamp = headers.get("svix-timestamp") ?? "";
  const svixSignature = headers.get("svix-signature") ?? "";
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Verify timestamp is within 5 minutes to prevent replay attacks
  const ts = parseInt(svixTimestamp, 10);
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const toSign = `${svixId}.${svixTimestamp}.${body}`;
  const expected = createHmac("sha256", secret).update(toSign).digest("base64");
  const signatures = svixSignature.split(" ").map((s) => s.replace(/^v1,/, ""));
  return signatures.some((sig) => sig === expected);
}

const EVENT_TO_STATUS: Record<string, string> = {
  "email.sent":      "sent",
  "email.delivered": "delivered",
  "email.bounced":   "failed",
};

export async function POST(request: NextRequest) {
  const body = await request.text();

  if (!verifySignature(body, request.headers)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: ResendWebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const emailId = payload.data?.email_id;
  if (!emailId) return NextResponse.json({ ok: true }); // Ignore events without email_id

  try {
    const supabase = await createClient();

    // Find the message by provider_id (Resend email ID)
    const { data: message } = await supabase.from("messages")
      .select("id, venue_id, status")
      .eq("provider_id", emailId)
      .maybeSingle<{ id: string; venue_id: string; status: string }>();

    if (!message) {
      // Unknown message — could be from before this system; ignore gracefully
      return NextResponse.json({ ok: true });
    }

    // Update message status if applicable
    const newStatus = EVENT_TO_STATUS[payload.type];
    if (newStatus && message.status !== "delivered") { // Don't downgrade from delivered
      const patch: Record<string, unknown> = { status: newStatus };
      if (payload.type === "email.delivered") patch.delivered_at = new Date().toISOString();
      if (payload.type === "email.bounced") patch.error_message = `Bounced at ${payload.data.bounced_at ?? payload.created_at}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("messages") as any).update(patch).eq("id", message.id);
    }

    // Always log the event for audit trail
    await supabase.from("message_events").insert({
      venue_id: message.venue_id,
      message_id: message.id,
      event_type: payload.type,
      occurred_at: payload.created_at ?? new Date().toISOString(),
      payload: payload as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Messaging webhook error:", err);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}
