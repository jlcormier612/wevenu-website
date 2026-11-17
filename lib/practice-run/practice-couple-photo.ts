/**
 * Practice Run couple photo — approved starter image for Maya & Jordan.
 * Bundled under public/practice (from the Willow Grove Hayes marketing asset).
 * Shared across Practice Runs; never deleted on reset.
 *
 * Store a same-origin relative path so Sandbox/Production never depend on
 * NEXT_PUBLIC_APP_URL (which can be wrong in container runtimes).
 *
 * Writes use the service role because trg_guard_relationship_client_photo
 * blocks authenticated venue sessions from setting client_photo_* columns
 * (those fields are couple-owned via portal RPCs).
 */

import { createClient as createServiceClient } from "@supabase/supabase-js";

export const PRACTICE_COUPLE_PHOTO_PUBLIC_PATH = "/practice/maya-jordan-couple.png";

export function practiceCouplePhotoUrl(): string {
  return PRACTICE_COUPLE_PHOTO_PUBLIC_PATH;
}

function serviceClientOrNull() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Attach the practice couple photo to the sample relationship so the Client
 * portal hero shows a personalized photo (same presentation model as Olivia & James).
 */
export async function seedPracticeCouplePhoto(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _client: any,
  venueId: string,
  relationshipId: string | null | undefined,
): Promise<boolean> {
  if (!relationshipId) return false;
  const admin = serviceClientOrNull();
  if (!admin) return false;
  const photoUrl = practiceCouplePhotoUrl();
  const { error } = await admin
    .from("venue_customer_relationships")
    .update({
      client_photo_url: photoUrl,
      client_photo_shared: true,
      venue_display_source: "client",
      updated_at: new Date().toISOString(),
    })
    .eq("venue_id", venueId)
    .eq("id", relationshipId);
  return !error;
}
