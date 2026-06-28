/**
 * Messaging application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import * as repo from "@/lib/messaging/repository";
import type {
  ComposeInput,
  MessageEntityType,
  MessageThread,
  SendResult,
  ThreadWithMessages,
} from "@/lib/messaging/types";
import { getCurrentVenue } from "@/lib/venue/service";

async function getVenueAndClient() {
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  // Get owner name for from: field
  const { data: staff } = await supabase.from("venue_staff")
    .select("full_name").eq("venue_id", venue.id).eq("is_owner", true).maybeSingle<{ full_name: string }>();
  return { venue, supabase, ownerName: staff?.full_name ?? venue.name };
}

export async function getThreads(): Promise<MessageThread[]> {
  if (!isSupabaseConfigured) return [];
  const ctx = await getVenueAndClient();
  if (!ctx) return [];
  return repo.getThreads(ctx.supabase, ctx.venue.id);
}

export async function getThreadsForEntity(
  entityType: MessageEntityType,
  entityId: string,
): Promise<ThreadWithMessages[]> {
  if (!isSupabaseConfigured) return [];
  const ctx = await getVenueAndClient();
  if (!ctx) return [];
  return repo.getThreadsForEntity(ctx.supabase, ctx.venue.id, entityType, entityId);
}

export async function sendMessage(
  entityType: MessageEntityType,
  entityId: string,
  input: ComposeInput,
): Promise<SendResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const ctx = await getVenueAndClient();
  if (!ctx) return { ok: false, message: "Session expired." };
  const { venue, supabase, ownerName } = ctx;

  // Determine from address
  const fromEmail = process.env.FROM_EMAIL
    ? process.env.FROM_EMAIL.replace(/^.*<(.+)>$/, "$1").trim()
    : null;
  const fromName = ownerName;

  try {
    // 1. Create thread + message record (status=sending)
    const { threadId, messageId } = await repo.sendMessage(
      supabase, venue.id, entityType, entityId,
      fromName, fromEmail, input, null, "sending",
    );

    // 2. Send via Resend (or mailto fallback — not suitable for logging)
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const emailResult = await sendEmail({
        to: input.toEmail,
        subject: input.subject,
        text: input.body,
        replyTo: venue.email ?? undefined,
        threadId,
      });

      if (emailResult.ok && emailResult.method === "resend") {
        await repo.updateMessageStatus(supabase, venue.id, messageId, "sent");
      } else if (!emailResult.ok) {
        await repo.updateMessageStatus(supabase, venue.id, messageId, "failed", undefined, emailResult.message);
        return { ok: false, message: emailResult.message };
      }
    } else {
      // No API key — mark as sent anyway (user is expected to use mailto fallback UI)
      await repo.updateMessageStatus(supabase, venue.id, messageId, "sent");
    }

    // 3. Save attachments
    if (input.attachments?.length) {
      await supabase.from("message_attachments").insert(
        input.attachments.map((a) => ({
          message_id: messageId,
          venue_id: venue.id,
          name: a.name,
          storage_path: a.storagePath,
          storage_url: a.storageUrl,
          mime_type: a.mimeType,
          file_size: a.fileSize,
        })),
      );
    }

    return { ok: true, threadId, messageId };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Send failed." };
  }
}
