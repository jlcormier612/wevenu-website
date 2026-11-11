import { createClient } from "@/integrations/supabase/server";

export type RelationshipPhotoRow = {
  relationship_id: string;
  venue_id: string;
  venue_photo_url: string | null;
  venue_display_source: "none" | "venue" | "client";
  client_photo_url: string | null;
  client_photo_shared: boolean;
  displayed_photo_url: string | null;
  effective_display_source: "none" | "venue" | "client";
};

type Db = Awaited<ReturnType<typeof createClient>>;

export async function getVenueRelationshipPhoto(
  client: Db,
  relationshipId: string,
): Promise<RelationshipPhotoRow | null> {
  const { data, error } = await client
    .from("venue_relationship_photos")
    .select("*")
    .eq("relationship_id", relationshipId)
    .maybeSingle<RelationshipPhotoRow>();
  if (error || !data) return null;
  return data;
}

export async function updateRelationshipPhotoFields(
  client: Db,
  venueId: string,
  relationshipId: string,
  fields: {
    venue_photo_url?: string | null;
    venue_display_source?: "none" | "venue" | "client";
    client_photo_url?: string | null;
    client_photo_shared?: boolean;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await client
    .from("venue_customer_relationships")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", relationshipId)
    .eq("venue_id", venueId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
