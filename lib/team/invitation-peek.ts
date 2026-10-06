import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

/** Read-only: invited email for a still-pending team invitation token. */
export async function peekPendingInvitationEmail(
  token: string,
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const trimmed = token.trim();
  if (!trimmed) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("venue_staff")
    .select("email")
    .eq("invite_token", trimmed)
    .is("accepted_at", null)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data?.email) return null;
  const email = String(data.email).trim().toLowerCase();
  return email.includes("@") ? email : null;
}
