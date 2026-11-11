import type { createClient } from "@/integrations/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

async function staffBelongsToVenue(supabase: Db, venueId: string, staffId: string): Promise<boolean> {
  const { data } = await supabase
    .from("venue_staff")
    .select("id")
    .eq("id", staffId)
    .eq("venue_id", venueId)
    .eq("is_active", true)
    .maybeSingle<{ id: string }>();
  return !!data;
}

export async function persistLeadStaffAssignment(
  supabase: Db,
  venueId: string,
  leadId: string,
  staffId: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (staffId && !(await staffBelongsToVenue(supabase, venueId, staffId))) {
    return { ok: false, message: "That team member is not on this venue." };
  }
  const { error } = await supabase
    .from("leads")
    .update({ assigned_staff_id: staffId })
    .eq("id", leadId)
    .eq("venue_id", venueId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Idempotent column write. Does not insert roster rows. */
export async function persistEventStaffAssignment(
  supabase: Db,
  venueId: string,
  eventId: string,
  staffId: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (staffId && !(await staffBelongsToVenue(supabase, venueId, staffId))) {
    return { ok: false, message: "That team member is not on this venue." };
  }
  const { error } = await supabase
    .from("events")
    .update({ assigned_staff_id: staffId })
    .eq("id", eventId)
    .eq("venue_id", venueId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
