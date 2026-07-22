/**
 * Meta Lead Ads webhook. Two genuinely different pieces:
 *
 *  - GET: the one-time subscription verification handshake Meta requires
 *    before it will register a webhook at all (hub.mode=subscribe,
 *    hub.verify_token, hub.challenge — echo the challenge back as plain
 *    text if the verify token matches). No precedent for this in the
 *    codebase; genuinely new.
 *  - POST: the actual delivery — deliberately thin, mirroring Resend's own
 *    delivery-webhook shape (verify signature, identify the venue, then
 *    only enqueue a job rather than doing any real work inline) since
 *    Meta's payload only ever contains a leadgen_id, never the lead's
 *    actual submitted field data — a second Graph API call
 *    (lib/facebook/processor.ts) is required to fetch that, and doing it
 *    synchronously here risks Meta timing out the webhook and retrying
 *    unnecessarily.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import * as repo from "@/lib/facebook/repository";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed." }, { status: 403 });
}

function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

type LeadgenChange = { field: string; value: { leadgen_id: string; page_id: string; form_id: string } };
type WebhookPayload = { object: string; entry: { id: string; changes: LeadgenChange[] }[] };

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (appSecret) {
    const signature = request.headers.get("x-hub-signature-256");
    if (!verifySignature(rawBody, signature, appSecret)) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const admin = createAdminClient();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const { leadgen_id: leadgenId, page_id: pageId, form_id: formId } = change.value;

      const { data: connectionRows } = await admin.from("facebook_connections")
        .select("venue_id").eq("page_id", pageId).eq("status", "connected").limit(1);
      const venueId = (connectionRows as { venue_id: string }[] | null)?.[0]?.venue_id;
      if (!venueId) continue; // Page not connected to any venue — nothing to do.

      const { data: formRows } = await admin.from("facebook_lead_forms")
        .select("id").eq("venue_id", venueId).eq("form_id", formId).eq("is_enabled", true).limit(1);
      if (!formRows?.length) continue; // Form not enabled for this venue — skip, per design.

      await repo.enqueueLead(admin, { venueId, leadgenId, formId, pageId });
    }
  }

  return NextResponse.json({ ok: true });
}
