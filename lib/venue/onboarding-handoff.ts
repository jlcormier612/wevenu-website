/**
 * Trusted one-time venue onboarding handoff.
 * Created server-side after purchase activation. Consumed after authentication.
 * Never authorized by a client-supplied venue id.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { syncActiveVenueCookieFromDb } from "@/lib/venue/active-context-cookie";

export async function createPurchaseOnboardingHandoff(input: {
  userId: string;
  intendedEmail: string;
  venueId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "not_configured" };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_venue_onboarding_handoff", {
    p_user_id: input.userId,
    p_intended_email: input.intendedEmail,
    p_venue_id: input.venueId,
    p_origin: "purchase_activation",
  });
  if (error) return { ok: false, error: error.message };
  const payload = data as { ok?: boolean; error?: string } | null;
  if (!payload?.ok) return { ok: false, error: payload?.error ?? "handoff_create_failed" };
  return { ok: true };
}

export async function consumeOnboardingHandoff(): Promise<
  { ok: true; venueId: string } | { ok: false; error: string }
> {
  if (!isSupabaseConfigured) return { ok: false, error: "not_configured" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_venue_onboarding_handoff");
  if (error) return { ok: false, error: error.message };
  const payload = data as { ok?: boolean; error?: string; venueId?: string } | null;
  if (!payload?.ok || !payload.venueId) {
    return { ok: false, error: payload?.error ?? "no_handoff" };
  }
  await syncActiveVenueCookieFromDb(payload.venueId);
  return { ok: true, venueId: payload.venueId };
}
