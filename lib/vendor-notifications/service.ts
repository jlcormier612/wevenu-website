/**
 * Vendor in-app notification center — inbox RPCs over vendor_notifications.
 * Writes are produced by DB triggers (assignment, message, task, share).
 *
 * new_message rows are reconciled against the live vendor conversation inbox
 * so CASCADE-deleted threads cannot leave ghost unread badges.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as conversationsRepo from "@/lib/conversations/repository";
import { reconcileVendorMessageNotifications } from "./reconcile-message-notifications";
import type { VendorNotification, VendorNotificationsResponse } from "./types";

export async function getVendorNotifications(
  limit = 40,
): Promise<VendorNotificationsResponse> {
  if (!isSupabaseConfigured) return { notifications: [], unreadCount: 0 };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_vendor_notifications", {
    p_limit: limit,
  });

  if (error) {
    console.error("[getVendorNotifications]", error.message);
    return { notifications: [], unreadCount: 0 };
  }

  const result = data as {
    notifications?: VendorNotification[];
    unreadCount?: number;
    error?: string;
  } | null;

  if (result?.error) return { notifications: [], unreadCount: 0 };

  const notifications = result?.notifications ?? [];
  const unreadCount = result?.unreadCount ?? 0;

  // Skip inbox RPC when nothing looks like a message alert.
  if (!notifications.some((n) => n.type === "new_message")) {
    return { notifications, unreadCount };
  }

  try {
    const inbox = await conversationsRepo.getVendorConversationInbox(supabase);
    return await reconcileVendorMessageNotifications(
      supabase,
      notifications,
      inbox.conversations,
      unreadCount,
    );
  } catch (err) {
    console.error("[getVendorNotifications] reconcile failed:", err);
    return { notifications, unreadCount };
  }
}

export async function markVendorNotificationsRead(
  ids: string[] = [],
): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_vendor_notifications_read", {
    p_notification_ids: ids,
  });

  if (error) {
    console.error("[markVendorNotificationsRead]", error.message);
    return { ok: false };
  }

  const result = data as { ok?: boolean } | null;
  return { ok: result?.ok ?? false };
}

/** Empty ids = clear all for the current vendor; otherwise delete those rows. */
export async function clearVendorNotifications(
  ids: string[] = [],
): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clear_vendor_notifications", {
    p_notification_ids: ids,
  });

  if (error) {
    console.error("[clearVendorNotifications]", error.message);
    return { ok: false };
  }

  const result = data as { ok?: boolean } | null;
  return { ok: result?.ok ?? false };
}
