/**
 * Narrow White Glove operator write access: authorized HQ admin becomes
 * temporary venue_staff on the real venue so existing RLS + Setup Hub work.
 * Does not weaken RLS globally. Session is explicit and reversible.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { requireAdminUser } from "@/lib/hq/crm-service";

export async function startOperatorVenueSession(
  venueId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "not_configured" };
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, error: "unauthorized" };

  const admin = createAdminClient();

  // Deactivate any prior operator staff rows for this HQ admin at other venues
  // so current_user_venue_id() resolves to the venue being configured.
  await admin
    .from("venue_staff")
    .update({ is_active: false })
    .eq("user_id", actor.userId)
    .eq("role", "manager")
    .eq("is_owner", false)
    .neq("venue_id", venueId);

  const { data: existing } = await admin
    .from("venue_staff")
    .select("id")
    .eq("venue_id", venueId)
    .eq("user_id", actor.userId)
    .maybeSingle<{ id: string }>();

  if (existing?.id) {
    const { error } = await admin
      .from("venue_staff")
      .update({
        is_active: true,
        role: "manager",
        is_owner: false,
        accepted_at: new Date().toISOString(),
        full_name: actor.name,
        email: actor.name.includes("@") ? actor.name : null,
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin.from("venue_staff").insert({
      venue_id: venueId,
      user_id: actor.userId,
      full_name: actor.name,
      email: actor.name.includes("@") ? actor.name : `${actor.userId}@hq.local`,
      role: "manager",
      is_owner: false,
      accepted_at: new Date().toISOString(),
      is_active: true,
    });
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function endOperatorVenueSession(
  venueId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "not_configured" };
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, error: "unauthorized" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("venue_staff")
    .update({ is_active: false })
    .eq("venue_id", venueId)
    .eq("user_id", actor.userId)
    .eq("is_owner", false);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
