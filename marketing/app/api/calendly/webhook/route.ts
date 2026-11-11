import { NextResponse } from "next/server";

import {
  extractCalendlyInvitee,
  type CalendlyWebhookBody,
} from "@/lib/calendly/parse";
import { assertCalendlyWebhookAuth } from "@/lib/calendly/webhook-auth";
import {
  syncCalendlyCanceledToRelationship,
  syncCalendlyCreatedToRelationship,
} from "@/lib/relationships/bridge";

export const runtime = "nodejs";

/**
 * Calendly webhook → shared Relationship store (marketing ECS / Vercel).
 *
 * Configure in Calendly Developer → Webhooks:
 *   URL:  https://<marketing-host>/api/calendly/webhook
 *   Events: invitee.created, invitee.canceled
 *
 * Auth (required — fail closed when unset; no CRM writes before auth):
 *   CALENDLY_WEBHOOK_SIGNING_KEY — verifies Calendly-Webhook-Signature
 * Optional fallback when signing key is unset:
 *   CALENDLY_WEBHOOK_SHARED_SECRET — require header x-calendly-webhook-secret
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const auth = assertCalendlyWebhookAuth({
    signingKey: process.env.CALENDLY_WEBHOOK_SIGNING_KEY,
    sharedSecret: process.env.CALENDLY_WEBHOOK_SHARED_SECRET,
    signatureHeader: request.headers.get("calendly-webhook-signature"),
    rawBody,
    request,
  });
  if (!auth.ok) {
    if (auth.status === 503) {
      console.error(
        "[calendly] webhook rejected — CALENDLY_WEBHOOK_SIGNING_KEY (or shared secret) unset",
      );
    }
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: CalendlyWebhookBody;
  try {
    body = JSON.parse(rawBody) as CalendlyWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const event = body.event?.trim();
  const invitee = extractCalendlyInvitee(body);
  if (!invitee) {
    return NextResponse.json({ error: "Missing invitee email." }, { status: 400 });
  }

  try {
    if (event === "invitee.created") {
      await syncCalendlyCreatedToRelationship(invitee);
      return NextResponse.json({ ok: true, event });
    }
    if (event === "invitee.canceled") {
      await syncCalendlyCanceledToRelationship(invitee);
      return NextResponse.json({ ok: true, event });
    }
    return NextResponse.json({ ok: true, ignored: event ?? "unknown" });
  } catch (error) {
    console.error("[calendly] webhook failed", error);
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}
