/**
 * Couple portal in-app notification center — token-gated RPCs over
 * couple_notifications (message-only MVP). Writes come from the
 * conversation_messages trigger and optional app dual-writes.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { CoupleNotification, CoupleNotificationsResponse } from "./types";

export async function getCoupleNotifications(
  token: string,
  limit = 40,
): Promise<CoupleNotificationsResponse & { error?: string }> {
  if (!isSupabaseConfigured) return { notifications: [], unreadCount: 0 };
  if (!token.trim()) return { notifications: [], unreadCount: 0, error: "invalid_token" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_couple_notifications", {
    p_token: token,
    p_limit: limit,
  });

  if (error) {
    console.error("[getCoupleNotifications]", error.message);
    return { notifications: [], unreadCount: 0, error: "rpc_failed" };
  }

  const result = data as {
    notifications?: CoupleNotification[];
    unreadCount?: number;
    error?: string;
  } | null;

  if (result?.error) {
    return { notifications: [], unreadCount: 0, error: result.error };
  }

  return {
    notifications: result?.notifications ?? [],
    unreadCount: result?.unreadCount ?? 0,
  };
}

export async function markCoupleNotificationsRead(
  token: string,
  ids: string[] = [],
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false };
  if (!token.trim()) return { ok: false, error: "invalid_token" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_couple_notifications_read", {
    p_token: token,
    p_notification_ids: ids,
  });

  if (error) {
    console.error("[markCoupleNotificationsRead]", error.message);
    return { ok: false };
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (result?.error) return { ok: false, error: result.error };
  return { ok: result?.ok ?? false };
}

/** Empty ids = clear all for the portal client; otherwise delete those rows. */
export async function clearCoupleNotifications(
  token: string,
  ids: string[] = [],
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false };
  if (!token.trim()) return { ok: false, error: "invalid_token" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clear_couple_notifications", {
    p_token: token,
    p_notification_ids: ids,
  });

  if (error) {
    console.error("[clearCoupleNotifications]", error.message);
    return { ok: false };
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (result?.error) return { ok: false, error: result.error };
  return { ok: result?.ok ?? false };
}
