/**
 * Hello to Cheers HQ — Customer Success workflow mutations (notes, tasks, next
 * contact date) plus the View-As audit log write. Server-only.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getHqAdmin } from "@/lib/hq/service";
import { recordEngagementEvent } from "@/lib/activation/service";

export async function requireAdminUser(): Promise<{ userId: string; name: string } | null> {
  if (!isSupabaseConfigured) return null;
  const admin = await getHqAdmin();
  if (!admin) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { userId: user.id, name: user.email ?? "Hello to Cheers team" };
}

export async function addVenueNote(venueId: string, body: string): Promise<boolean> {
  const actor = await requireAdminUser();
  if (!actor || !body.trim()) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("venue_hq_notes").insert({
    venue_id: venueId,
    author_id: actor.userId,
    author_name: actor.name,
    body: body.trim(),
  });
  return !error;
}

export async function addVenueTask(
  venueId: string, title: string, dueDate: string | null,
  opts?: { kind?: "task" | "blocker"; engagementId?: string | null },
): Promise<boolean> {
  const actor = await requireAdminUser();
  if (!actor || !title.trim()) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("venue_hq_tasks").insert({
    venue_id: venueId,
    assigned_id: actor.userId,
    assigned_name: actor.name,
    title: title.trim(),
    due_date: dueDate,
    kind: opts?.kind ?? "task",
    engagement_id: opts?.engagementId ?? null,
  });
  return !error;
}

export async function completeVenueTask(taskId: string): Promise<boolean> {
  const actor = await requireAdminUser();
  if (!actor) return false;
  const supabase = await createClient();
  const { error } = await supabase
    .from("venue_hq_tasks")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", taskId);
  return !error;
}

export async function setNextContact(venueId: string, nextContactAt: string | null): Promise<boolean> {
  const actor = await requireAdminUser();
  if (!actor) return false;
  const supabase = await createClient();
  const { error } = await supabase
    .from("venue_hq_crm_state")
    .upsert({ venue_id: venueId, next_contact_at: nextContactAt, updated_at: new Date().toISOString() }, { onConflict: "venue_id" });
  return !error;
}

export async function markVenueContacted(venueId: string): Promise<boolean> {
  const actor = await requireAdminUser();
  if (!actor) return false;
  const supabase = await createClient();
  const { error } = await supabase
    .from("venue_hq_crm_state")
    .upsert({ venue_id: venueId, last_contacted_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "venue_id" });
  return !error;
}

/** Records that an HQ admin opened the read-only View-As snapshot for a venue. */
export async function recordViewAs(venueId: string): Promise<void> {
  const actor = await requireAdminUser();
  if (!actor) return;
  void recordEngagementEvent({
    venueId,
    eventType: "hq.view_as",
    actorType: "hq_admin",
    actorId: actor.userId,
  });
}

/**
 * HQ-only Event Orders rollout toggle for one venue.
 * Updates only venues.event_order_enabled — does not create, delete, or
 * mutate Event Order rows. Uses the service-role client (same pattern as
 * other HQ venue mutations that must bypass venue-scoped RLS).
 */
export async function setEventOrderEnabled(
  venueId: string,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("venues")
      .update({ event_order_enabled: enabled })
      .eq("id", venueId);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not update Event Orders flag." };
  }
}
