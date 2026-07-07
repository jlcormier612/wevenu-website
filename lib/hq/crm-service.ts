/**
 * Wevenu HQ — Customer Success workflow mutations (notes, tasks, next
 * contact date) plus the View-As audit log write. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getHqAdmin } from "@/lib/hq/service";
import { recordEngagementEvent } from "@/lib/activation/service";

async function requireAdminUser(): Promise<{ userId: string; name: string } | null> {
  if (!isSupabaseConfigured) return null;
  const admin = await getHqAdmin();
  if (!admin) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { userId: user.id, name: user.email ?? "Wevenu team" };
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

export async function addVenueTask(venueId: string, title: string, dueDate: string | null): Promise<boolean> {
  const actor = await requireAdminUser();
  if (!actor || !title.trim()) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("venue_hq_tasks").insert({
    venue_id: venueId,
    assigned_id: actor.userId,
    assigned_name: actor.name,
    title: title.trim(),
    due_date: dueDate,
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
