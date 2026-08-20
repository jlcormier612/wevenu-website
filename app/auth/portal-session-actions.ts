"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/integrations/supabase/server";
import { safeInternalNextPath } from "@/lib/auth/portal-home";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Sign out and return to an invite/accept URL so the user can create or sign
 * into the intended portal identity without inheriting the previous session.
 */
export async function switchAccountForInviteAction(
  returnTo: string,
): Promise<void> {
  const next = safeInternalNextPath(returnTo);
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect(next ?? "/login");
}
