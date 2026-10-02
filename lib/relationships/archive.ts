/**
 * Relationship-level Archive — ACTIVE → ARCHIVED.
 *
 * Archive is not Delete. It removes the relationship from active venue
 * surfaces while preserving lead/client history, contracts, invoices,
 * payments, documents, tours, and communications.
 *
 * Authority: venue_customer_relationships.archived_at
 * Restore: clears archived_at / archived_by.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

export type ArchiveResult = { ok: true } | { ok: false; message: string };

async function withVenueActor(
  fn: (
    supabase: Awaited<ReturnType<typeof createClient>>,
    venueId: string,
    userId: string | null,
  ) => Promise<ArchiveResult>,
): Promise<ArchiveResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return fn(supabase, venue.id, user?.id ?? null);
}

async function resolveRelationshipId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  opts: { relationshipId?: string | null; leadId?: string | null; clientId?: string | null },
): Promise<{ ok: true; relationshipId: string } | { ok: false; message: string }> {
  if (opts.relationshipId) {
    const { data } = await supabase
      .from("venue_customer_relationships")
      .select("id")
      .eq("id", opts.relationshipId)
      .eq("venue_id", venueId)
      .maybeSingle<{ id: string }>();
    if (!data) return { ok: false, message: "Relationship not found." };
    return { ok: true, relationshipId: data.id };
  }
  if (opts.leadId) {
    const { data } = await supabase
      .from("leads")
      .select("relationship_id")
      .eq("id", opts.leadId)
      .eq("venue_id", venueId)
      .maybeSingle<{ relationship_id: string | null }>();
    if (!data?.relationship_id) {
      return { ok: false, message: "This lead has no relationship to archive." };
    }
    return { ok: true, relationshipId: data.relationship_id };
  }
  if (opts.clientId) {
    const { data } = await supabase
      .from("clients")
      .select("relationship_id")
      .eq("id", opts.clientId)
      .eq("venue_id", venueId)
      .maybeSingle<{ relationship_id: string | null }>();
    if (!data?.relationship_id) {
      return { ok: false, message: "This client has no relationship to archive." };
    }
    return { ok: true, relationshipId: data.relationship_id };
  }
  return { ok: false, message: "A relationship is required." };
}

export async function archiveRelationship(opts: {
  relationshipId?: string | null;
  leadId?: string | null;
  clientId?: string | null;
}): Promise<ArchiveResult> {
  return withVenueActor(async (supabase, venueId, userId) => {
    const resolved = await resolveRelationshipId(supabase, venueId, opts);
    if (!resolved.ok) return resolved;
    const { error } = await supabase
      .from("venue_customer_relationships")
      .update({
        archived_at: new Date().toISOString(),
        archived_by: userId,
      })
      .eq("id", resolved.relationshipId)
      .eq("venue_id", venueId)
      .is("archived_at", null);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  });
}

export async function restoreRelationship(opts: {
  relationshipId?: string | null;
  leadId?: string | null;
  clientId?: string | null;
}): Promise<ArchiveResult> {
  return withVenueActor(async (supabase, venueId) => {
    const resolved = await resolveRelationshipId(supabase, venueId, opts);
    if (!resolved.ok) return resolved;
    const { error } = await supabase
      .from("venue_customer_relationships")
      .update({
        archived_at: null,
        archived_by: null,
      })
      .eq("id", resolved.relationshipId)
      .eq("venue_id", venueId)
      .not("archived_at", "is", null);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  });
}

export async function getRelationshipArchiveState(
  relationshipId: string,
): Promise<{ archivedAt: string | null } | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("venue_customer_relationships")
    .select("archived_at")
    .eq("id", relationshipId)
    .eq("venue_id", venue.id)
    .maybeSingle<{ archived_at: string | null }>();
  if (!data) return null;
  return { archivedAt: data.archived_at };
}
