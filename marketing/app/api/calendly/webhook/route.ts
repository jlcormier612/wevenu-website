import { NextResponse } from "next/server";

import {
  extractCalendlyInvitee,
  type CalendlyWebhookBody,
} from "@/lib/calendly/parse";
import {
  verifyCalendlySignature,
  verifySharedSecretHeader,
} from "@/lib/calendly/verify";
import {
  syncCalendlyCanceledToRelationship,
  syncCalendlyCreatedToRelationship,
} from "@/lib/relationships/bridge";

export const runtime = "nodejs";

/**
 * Calendly webhook → shared Relationship store.
 *
 * Configure in Calendly Developer → Webhooks:
 *   URL:  https://<marketing-host>/api/calendly/webhook
 *   Events: invitee.created, invitee.canceled
 *
 * Auth (prefer signing key from the webhook subscription response):
 *   CALENDLY_WEBHOOK_SIGNING_KEY — verifies Calendly-Webhook-Signature
 * Optional fallback when signing key is unset:
 *   CALENDLY_WEBHOOK_SHARED_SECRET — require header x-calendly-webhook-secret
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY?.trim();
  const sharedSecret = process.env.CALENDLY_WEBHOOK_SHARED_SECRET?.trim();

  if (signingKey) {
    const signature = request.headers.get("calendly-webhook-signature");
    if (!verifyCalendlySignature(signature, rawBody, signingKey)) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }
  } else if (sharedSecret) {
    if (!verifySharedSecretHeader(request, sharedSecret)) {
      return NextResponse.json(
        { error: "Invalid or missing webhook secret." },
        { status: 401 },
      );
    }
  } else {
    console.warn(
      "[calendly] CALENDLY_WEBHOOK_SIGNING_KEY unset — accepting unverified webhook (dev only).",
    );
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
