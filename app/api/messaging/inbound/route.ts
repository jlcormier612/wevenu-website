/**
 * POST /api/messaging/inbound
 *
 * Handles inbound email from Resend's inbound routing feature.
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
 * Resend inbound payload:
 * {
 *   "from": "sender@example.com",
 *   "to": ["thread+abc123@replies.venue.com"],
 *   "subject": "Re: Your venue",
 *   "text": "body text",
 *   "html": "<p>body</p>",
 *   "headers": [{"name": "In-Reply-To", "value": "<resend-id>"}]
 * }
 */

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

type InboundPayload = {
  from: string;
  to: string[];
  subject?: string;
  text?: string;
  html?: string;
  headers?: { name: string; value: string }[];
};

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
  // Basic auth check: Resend sends a secret token as a query param or header
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const providedSecret = request.nextUrl.searchParams.get("secret");
  if (secret && providedSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: InboundPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { email: fromEmail, name: fromName } = parseFromEmail(payload.from ?? "");
  const body = payload.text ?? payload.html?.replace(/<[^>]+>/g, "") ?? "";
  if (!fromEmail || !body) return NextResponse.json({ ok: true });

  const supabase = await createClient();

  // --- 1. Match by subaddressing (thread+{id}@domain) ---
  let threadId = extractThreadIdFromTo(payload.to ?? []);

  // --- 2. Match by In-Reply-To header → provider_id ---
  if (!threadId) {
    const inReplyTo = payload.headers?.find((h) => h.name.toLowerCase() === "in-reply-to")?.value;
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
        subject: payload.subject?.replace(/^Re:\s*/i, "").trim() ?? null,
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
  await supabase.from("messages").insert({
    thread_id: threadId,
    venue_id: venueId,
    direction: "inbound",
    from_name: fromName,
    from_email: fromEmail,
    subject: payload.subject ?? null,
    body: body.trim(),
    body_html: payload.html ?? null,
    channel: "email",
    status: "received",
    sent_at: new Date().toISOString(),
  });

  // Update thread message_count and last_message_at
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: thread } = await (supabase.from("message_threads") as any)
    .select("message_count").eq("id", threadId).maybeSingle() as { data: { message_count: number } | null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("message_threads") as any).update({
    last_message_at: new Date().toISOString(),
    message_count: (thread?.message_count ?? 0) + 1,
  }).eq("id", threadId);

  return NextResponse.json({ ok: true });
}
