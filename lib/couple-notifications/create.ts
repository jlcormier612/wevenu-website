/**
 * Best-effort insert into couple_notifications (service role).
 * Prefer the conversation_messages trigger for normal writes; use this when
 * an email notify path should also land an in-app row (2m dedupe with trigger).
 */
import { createAdminClient } from "@/integrations/supabase/admin";

export type CreateCoupleNotificationInput = {
  clientId: string;
  type?: "new_message";
  title: string;
  body?: string | null;
  link?: string | null;
  conversationId?: string | null;
};

function tryAdmin() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

export async function createCoupleNotification(
  input: CreateCoupleNotificationInput,
): Promise<void> {
  try {
    const admin = tryAdmin();
    if (!admin) return;

    const { error } = await admin.rpc("create_couple_notification", {
      p_client_id: input.clientId,
      p_type: input.type ?? "new_message",
      p_title: input.title,
      p_body: input.body ?? null,
      p_link: input.link ?? null,
      p_conversation_id: input.conversationId ?? null,
    });

    if (error) {
      await admin.from("couple_notifications").insert({
        client_id: input.clientId,
        type: input.type ?? "new_message",
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        conversation_id: input.conversationId ?? null,
      });
    }
  } catch (err) {
    console.error("[createCoupleNotification]", err);
  }
}
