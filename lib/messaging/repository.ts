import { createClient } from "@/integrations/supabase/server";
import type {
  ComposeInput,
  Message,
  MessageChannel,
  MessageDirection,
  MessageEntityType,
  MessageStatus,
  MessageThread,
  ThreadStatus,
  ThreadWithMessages,
} from "@/lib/messaging/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type ThreadRow = {
  id: string; venue_id: string;
  lead_id: string | null; client_id: string | null; event_id: string | null;
  subject: string | null; channel: MessageChannel; status: ThreadStatus;
  last_message_at: string | null; message_count: number;
  created_at: string; updated_at: string;
  // Joined fields
  leads?: { first_name: string; last_name: string; partner_first_name: string | null } | null;
  clients?: { first_name: string; last_name: string; partner_first_name: string | null } | null;
  events?: { name: string } | null;
  last_message?: { body: string; direction: MessageDirection } | null;
};

type MsgRow = {
  id: string; thread_id: string; venue_id: string;
  direction: MessageDirection; from_name: string | null; from_email: string | null;
  to_email: string | null; to_phone: string | null;
  subject: string | null; body: string; body_html: string | null;
  channel: MessageChannel; status: MessageStatus;
  provider_id: string | null; error_message: string | null;
  sent_at: string | null; delivered_at: string | null;
  luv_draft_id: string | null; created_at: string; updated_at: string;
};

function entityName(r: ThreadRow): string | null {
  if (r.leads) return [r.leads.first_name, r.leads.last_name].filter(Boolean).join(" ") + (r.leads.partner_first_name ? ` & ${r.leads.partner_first_name}` : "");
  if (r.clients) return [r.clients.first_name, r.clients.last_name].filter(Boolean).join(" ") + (r.clients.partner_first_name ? ` & ${r.clients.partner_first_name}` : "");
  if (r.events) return r.events.name;
  return null;
}

function mapThread(r: ThreadRow): MessageThread {
  return {
    id: r.id, venueId: r.venue_id,
    leadId: r.lead_id, clientId: r.client_id, eventId: r.event_id,
    subject: r.subject, channel: r.channel, status: r.status,
    lastMessageAt: r.last_message_at, messageCount: r.message_count,
    createdAt: r.created_at, updatedAt: r.updated_at,
    entityName: entityName(r),
    lastMessagePreview: r.last_message?.body?.slice(0, 80) ?? null,
    lastMessageDirection: r.last_message?.direction ?? null,
  };
}

function mapMessage(r: MsgRow): Message {
  return {
    id: r.id, threadId: r.thread_id, venueId: r.venue_id,
    direction: r.direction, fromName: r.from_name, fromEmail: r.from_email,
    toEmail: r.to_email, toPhone: r.to_phone,
    subject: r.subject, body: r.body, bodyHtml: r.body_html,
    channel: r.channel, status: r.status,
    providerId: r.provider_id, errorMessage: r.error_message,
    sentAt: r.sent_at, deliveredAt: r.delivered_at,
    luvDraftId: r.luv_draft_id, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

// ---- Threads ----------------------------------------------------------------

export async function getThreads(
  client: DbClient,
  venueId: string,
): Promise<MessageThread[]> {
  const { data, error } = await client.from("message_threads")
    .select("*, leads(first_name, last_name, partner_first_name), clients(first_name, last_name, partner_first_name), events(name)")
    .eq("venue_id", venueId)
    .eq("status", "active")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  const threads = data as unknown as ThreadRow[];
  // Fetch last message preview for each thread
  if (threads.length === 0) return [];
  const threadIds = threads.map((t) => t.id);
  const { data: lastMsgs } = await client.from("messages")
    .select("thread_id, body, direction")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false });
  const lastByThread = new Map<string, { body: string; direction: MessageDirection }>();
  for (const m of (lastMsgs ?? []) as { thread_id: string; body: string; direction: MessageDirection }[]) {
    if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m);
  }
  return threads.map((t) => mapThread({ ...t, last_message: lastByThread.get(t.id) ?? null }));
}

export async function getThreadsForEntity(
  client: DbClient,
  venueId: string,
  entityType: MessageEntityType,
  entityId: string,
): Promise<ThreadWithMessages[]> {
  const col = `${entityType}_id` as "lead_id" | "client_id" | "event_id";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: threadData, error } = await (client.from("message_threads")
    .select("*, leads(first_name, last_name, partner_first_name), clients(first_name, last_name, partner_first_name), events(name)")
    .eq("venue_id", venueId) as any).eq(col, entityId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const threads = (threadData as unknown as ThreadRow[]) ?? [];
  if (threads.length === 0) return [];
  // Fetch messages for all threads in one query
  const threadIds = threads.map((t) => t.id);
  const { data: msgs } = await client.from("messages")
    .select("*").in("thread_id", threadIds).order("created_at");
  const msgsByThread = new Map<string, Message[]>();
  for (const m of (msgs ?? []) as MsgRow[]) {
    const arr = msgsByThread.get(m.thread_id) ?? [];
    arr.push(mapMessage(m));
    msgsByThread.set(m.thread_id, arr);
  }
  return threads.map((t) => ({
    ...mapThread(t),
    messages: msgsByThread.get(t.id) ?? [],
  }));
}

// ---- Send (create thread + message) -----------------------------------------

export async function sendMessage(
  client: DbClient,
  venueId: string,
  entityType: MessageEntityType,
  entityId: string,
  fromName: string | null,
  fromEmail: string | null,
  input: ComposeInput,
  providerId: string | null,
  status: MessageStatus,
): Promise<{ threadId: string; messageId: string }> {
  const entityCol = `${entityType}_id`;

  // Create the thread
  const { data: thread, error: threadErr } = await client.from("message_threads")
    .insert({
      venue_id: venueId,
      [entityCol]: entityId,
      subject: input.subject.trim() || null,
      channel: "email",
      status: "active",
      last_message_at: new Date().toISOString(),
      message_count: 1,
    })
    .select("id").single<{ id: string }>();
  if (threadErr) throw threadErr;

  // Auto-populate coordinator as thread participant (message_thread_participants foundation)
  await client.from("message_thread_participants").insert({
    venue_id: venueId, thread_id: thread.id,
    participant_type: "coordinator",
    contact_id: null,  // coordinator has no contact_id
    can_view: true, can_reply: true, receives_notifications: true,
    added_by: "system",
  }); // non-blocking — participant creation is best-effort

  // Create the message
  const { data: msg, error: msgErr } = await client.from("messages")
    .insert({
      thread_id: thread.id,
      venue_id: venueId,
      direction: "outbound",
      from_name: fromName,
      from_email: fromEmail,
      to_email: input.toEmail,
      subject: input.subject.trim() || null,
      body: input.body.trim(),
      channel: "email",
      status,
      provider_id: providerId,
      sent_at: status === "accepted" ? new Date().toISOString() : null,
      luv_draft_id: input.luvDraftId ?? null,
    })
    .select("id").single<{ id: string }>();
  if (msgErr) throw msgErr;

  return { threadId: thread.id, messageId: msg.id };
}

export async function updateMessageStatus(
  client: DbClient,
  venueId: string,
  messageId: string,
  status: MessageStatus,
  providerId?: string,
  errorMessage?: string,
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (providerId) patch.provider_id = providerId;
  if (errorMessage) patch.error_message = errorMessage;
  if (status === "accepted") patch.sent_at = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("messages") as any).update(patch).eq("id", messageId).eq("venue_id", venueId);
}
