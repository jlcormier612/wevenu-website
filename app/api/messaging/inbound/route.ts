/**
 * POST /api/messaging/inbound
 *
 * Handles inbound email from Resend's inbound routing feature. Reply-
 * matching only — an inbound email always maps to an *existing* lead/
 * client and can never originate a new one (see app/api/leads/email-intake
 * /route.ts for the route that does the opposite, by design).
 *
 * Setup required (external):
 *   1. In Resend Dashboard → Inbound → Add Domain → verify your domain
 *   2. Add an MX record pointing to Resend's inbound servers
 *   3. Set RESEND_INBOUND_ADDRESS=inbox@replies.yourdomain.com in .env
 *   4. Configure the inbound endpoint URL to point here
 *
 * Thread matching (in order):
 *   1. "In-Reply-To" header → matches messages.provider_id → uses that thread
 *   2. "To" address contains thread+{threadId}@ (subaddressing) → direct match
 *   3. Sender email matches a known lead/client → creates new thread
 *   4. Unknown sender → logs and skips (future: unmatched queue)
 *
 * Resend's real email.received webhook payload is metadata only — no body,
 * no headers. Signature verification and the follow-up GET
 * /emails/receiving/{email_id} call (which is what actually returns
 * text/html/headers, including In-Reply-To) are shared with
 * app/api/leads/email-intake/route.ts via lib/resend/inbound-webhook.ts —
 * see that module's doc comment for the verified details of both.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { exitActiveEnrollmentsForRelationship } from "@/lib/message-sequences/repository";
import { shouldAdvanceStatus } from "@/lib/communication/status";
import {
  fetchReceivedEmailContent,
  findHeaderValue,
  htmlToText,
  verifySvixSignature,
  type ResendInboundWebhookEvent,
} from "@/lib/resend/inbound-webhook";

function parseFromEmail(from: string): { email: string; name: string | null } {
  const match = from.match(/^(.*?)\s*<(.+)>$/);
  if (match) return { name: match[1].trim() || null, email: match[2].trim() };
  return { name: null, email: from.trim() };
}

function extractThreadIdFromTo(toAddresses: string[]): string | null {
  for (const addr of toAddresses) {
    const match = addr.match(/thread\+([a-f0-9-]+)@/);
    if (match) return match[1];
  }
  return null;
}

export async function POST(request: NextRequest) {
  // Svix verification needs the exact raw body — parsing first would break it.
  const rawBody = await request.text();

  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (webhookSecret) {
    const verified = verifySvixSignature(
      rawBody,
      {
        id: request.headers.get("svix-id"),
        timestamp: request.headers.get("svix-timestamp"),
        signature: request.headers.get("svix-signature"),
      },
      webhookSecret,
    );
    if (!verified) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  let event: ResendInboundWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (event.type !== "email.received" || !event.data) {
    // Not an inbound-email event — acknowledge and ignore rather than error.
    return NextResponse.json({ ok: true });
  }

  const { email_id, from, to, subject } = event.data;
  const content = await fetchReceivedEmailContent(email_id);
  const body = content?.text || (content?.html ? htmlToText(content.html) : "") || "";

  const { email: fromEmail, name: fromName } = parseFromEmail(from ?? "");
  if (!fromEmail || !body) return NextResponse.json({ ok: true });

  // TR-M7: this is a webhook call with no Supabase session, so it must use
  // the admin client — the anon/cookie client's writes were silently
  // rejected by RLS here, with every result ignored, so nothing ever worked.
  const supabase = createAdminClient();

  // --- 1. Match by subaddressing (thread+{id}@domain) ---
  let threadId = extractThreadIdFromTo(to ?? []);

  // --- 2. Match by In-Reply-To header → provider_id ---
  if (!threadId && content?.headers) {
    const inReplyTo = findHeaderValue(content.headers, "in-reply-to");
    if (inReplyTo) {
      const provId = inReplyTo.replace(/[<>]/g, "").trim();
      const { data: msg } = await supabase.from("messages")
        .select("thread_id").eq("provider_id", provId).maybeSingle<{ thread_id: string }>();
      if (msg) threadId = msg.thread_id;
    }
  }

  // --- 3. Match by sender email → lead or client ---
  let venueId: string | null = null;
  let entityType: "lead" | "client" | null = null;
  let entityId: string | null = null;

  if (threadId) {
    const { data: thread } = await supabase.from("message_threads")
      .select("venue_id, lead_id, client_id, event_id")
      .eq("id", threadId)
      .maybeSingle<{ venue_id: string; lead_id: string | null; client_id: string | null; event_id: string | null }>();
    if (thread) {
      venueId = thread.venue_id;
      if (thread.lead_id) { entityType = "lead"; entityId = thread.lead_id; }
      else if (thread.client_id) { entityType = "client"; entityId = thread.client_id; }
    }
  } else {
    // No thread found — try matching sender email to a lead or client
    const { data: leads } = await supabase.from("leads")
      .select("id, venue_id").eq("email", fromEmail).limit(1);
    if (leads?.length) {
      const lead = leads[0] as { id: string; venue_id: string };
      venueId = lead.venue_id;
      entityType = "lead";
      entityId = lead.id;
    } else {
      const { data: clients } = await supabase.from("clients")
        .select("id, venue_id").eq("email", fromEmail).limit(1);
      if (clients?.length) {
        const client = clients[0] as { id: string; venue_id: string };
        venueId = client.venue_id;
        entityType = "client";
        entityId = client.id;
      }
    }
  }

  if (!venueId || !entityType || !entityId) {
    // Unknown sender — log and skip
    console.warn("Inbound email from unknown sender:", fromEmail);
    return NextResponse.json({ ok: true });
  }

  // --- Create thread if needed ---
  if (!threadId) {
    const entityCol = `${entityType}_id`;
    const { data: thread } = await supabase.from("message_threads")
      .insert({
        venue_id: venueId,
        [entityCol]: entityId,
        subject: subject?.replace(/^Re:\s*/i, "").trim() ?? null,
        channel: "email",
        status: "active",
        last_message_at: new Date().toISOString(),
        message_count: 0,
      })
      .select("id").single<{ id: string }>();
    if (!thread) return NextResponse.json({ error: "Failed to create thread." }, { status: 500 });
    threadId = thread.id;
  }

  // --- Create inbound message ---
  const { error: insertError } = await supabase.from("messages").insert({
    thread_id: threadId,
    venue_id: venueId,
    direction: "inbound",
    from_name: fromName,
    from_email: fromEmail,
    subject: subject ?? null,
    body: body.trim(),
    body_html: content?.html || null,
    channel: "email",
    status: "received",
    sent_at: new Date().toISOString(),
  });
  if (insertError) {
    console.error("Inbound message insert failed:", insertError.message);
    return NextResponse.json({ error: "Failed to record message." }, { status: 500 });
  }

  // Update thread message_count and last_message_at
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: thread } = await (supabase.from("message_threads") as any)
    .select("message_count").eq("id", threadId).maybeSingle() as { data: { message_count: number } | null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase.from("message_threads") as any).update({
    last_message_at: new Date().toISOString(),
    message_count: (thread?.message_count ?? 0) + 1,
  }).eq("id", threadId);
  if (updateError) console.error("Thread update failed:", updateError.message);

  // Communication Trust Experience — the most recent outbound message in
  // this thread just got a reply; that's real news for a venue owner
  // wondering whether their message landed. Rank-guarded so a message
  // already marked "failed" (it never went) can't be overwritten.
  const { data: lastOutbound } = await supabase.from("messages")
    .select("id, status").eq("thread_id", threadId).eq("direction", "outbound")
    .order("created_at", { ascending: false }).limit(1).maybeSingle<{ id: string; status: string }>();
  if (lastOutbound && shouldAdvanceStatus(lastOutbound.status, "replied")) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("messages") as any).update({ status: "replied" }).eq("id", lastOutbound.id);
    // Message Timeline needs a timestamp for every transition — status
    // webhooks log their own event, but this transition happens here in
    // application code, so it must log its own event the same way.
    await supabase.from("message_events").insert({
      venue_id: venueId, message_id: lastOutbound.id, event_type: "replied", occurred_at: new Date().toISOString(),
    });
  }

  // Inbound reply = responsiveness signal — refresh scores immediately
  if (entityType === "lead" && entityId) {
    const { computeAndSaveLeadScores } = await import("@/lib/leads/scores");
    void computeAndSaveLeadScores(supabase, venueId, entityId).catch(() => {});
  }

  // Stop on reply (§3.3) — a reply means a human is handling this
  // personally now, so any Series in progress should get out of the way.
  const entityTable = entityType === "lead" ? "leads" : "clients";
  const { data: repliedEntity } = await supabase.from(entityTable).select("relationship_id")
    .eq("id", entityId).maybeSingle<{ relationship_id: string | null }>();
  if (repliedEntity?.relationship_id) {
    void exitActiveEnrollmentsForRelationship(supabase, venueId, repliedEntity.relationship_id, "exited_reply")
      .catch((e) => console.error("Series exit-on-reply failed:", e));
  }

  return NextResponse.json({ ok: true });
}
