/**
 * Wevenu HQ access control. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { HqAdmin, HqAdminRole } from "@/lib/hq/types";

/** Returns the current user's HQ admin record, or null if they have no HQ access. */
export async function getHqAdmin(): Promise<HqAdmin | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("current_hq_admin_role");
  if (error || !data) return null;
  return { role: data as HqAdminRole };
}
