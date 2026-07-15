/**
 * Messaging application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { translateEmailFailure } from "@/lib/communication/failure-messages";
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

    // 2. Send for real. Communication Trust Experience — this used to check
    // for an API key itself and mark the message "sent" without ever
    // calling sendEmail() when one was missing, which meant COMMUNICATION_
    // MODE and even a fully unconfigured venue could both silently claim
    // success with no attempt ever made. sendEmail() already owns every one
    // of those decisions (disabled mode, missing key → mailto); trust its
    // answer instead of duplicating the check here. A mailto result has no
    // meaning for a message composed and "sent" from inside the app itself
    // (there's no browser here to open a mail client), so it's treated as
    // not actually sent, same as any other failure.
    const emailResult = await sendEmail({
      to: input.toEmail,
      subject: input.subject,
      text: input.body,
      replyTo: venue.email ?? undefined,
      threadId,
    });

    if (emailResult.ok && (emailResult.method === "resend" || emailResult.method === "disabled")) {
      await repo.updateMessageStatus(supabase, venue.id, messageId, "accepted", emailResult.providerId);
    } else {
      const failMessage = emailResult.ok
        ? "Email isn't fully configured for this venue yet — add a Resend API key in Settings to send from here."
        : translateEmailFailure(emailResult.message);
      await repo.updateMessageStatus(supabase, venue.id, messageId, "failed", undefined, failMessage);
      return { ok: false, message: failMessage };
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
