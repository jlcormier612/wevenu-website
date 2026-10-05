/**
 * Dashboard Focus dismissal persistence. Venue-scoped presentation only.
 * Never writes payments, leads, tasks, contracts, or communications.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

export async function listDismissedDashboardAttentionKeys(): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_dismissed_dashboard_attention_keys");
  if (error) {
    console.error("[dashboard/attention-dismiss] list failed:", error);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.filter((k): k is string => typeof k === "string");
}

export async function dismissDashboardAttentionItem(
  itemKey: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "unavailable" };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "no venue" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dismiss_dashboard_attention_item", {
    p_item_key: itemKey,
  });
  if (error) {
    console.error("[dashboard/attention-dismiss] dismiss failed:", error);
    return { ok: false, error: "dismiss failed" };
  }
  const payload = data as { ok?: boolean; error?: string } | null;
  if (payload?.ok !== true) {
    return { ok: false, error: payload?.error ?? "dismiss failed" };
  }
  return { ok: true };
}
