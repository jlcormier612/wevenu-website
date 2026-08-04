/**
 * Best-effort insert into vendor_notifications (service role).
 * Prefer DB triggers for normal write paths; use this only when a code path
 * needs an in-app row alongside email and may not share a firing INSERT
 * (or as a resilient dual-write with dedupe).
 */
import { createAdminClient } from "@/integrations/supabase/admin";

export type CreateVendorNotificationInput = {
  vendorId: string;
  eventId?: string | null;
  assignmentId?: string | null;
  type: "new_message" | "new_task" | "document_shared" | "assigned_to_event";
  title: string;
  body?: string | null;
  link?: string | null;
  emoji?: string | null;
};

function tryAdmin() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

export async function createVendorNotification(
  input: CreateVendorNotificationInput,
): Promise<void> {
  try {
    const admin = tryAdmin();
    if (!admin) return;

    const { error } = await admin.rpc("create_vendor_notification", {
      p_vendor_id: input.vendorId,
      p_event_id: input.eventId ?? null,
      p_assignment_id: input.assignmentId ?? null,
      p_type: input.type,
      p_title: input.title,
      p_body: input.body ?? null,
      p_link: input.link ?? null,
      p_emoji: input.emoji ?? null,
    });

    if (error) {
      // Fallback direct insert when RPC not yet migrated in an env.
      await admin.from("vendor_notifications").insert({
        vendor_id: input.vendorId,
        event_id: input.eventId ?? null,
        assignment_id: input.assignmentId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        emoji: input.emoji ?? null,
      });
    }
  } catch (err) {
    console.error("[createVendorNotification]", err);
  }
}
