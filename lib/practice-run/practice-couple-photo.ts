/**
 * Practice Run couple photo — approved starter image for Maya & Jordan.
 * Bundled under public/practice (from the Willow Grove Hayes marketing asset).
 * Shared across Practice Runs; never deleted on reset.
 *
 * Store a same-origin relative path so Sandbox/Production never depend on
 * NEXT_PUBLIC_APP_URL (which can be wrong in container runtimes).
 */

export const PRACTICE_COUPLE_PHOTO_PUBLIC_PATH = "/practice/maya-jordan-couple.png";

export function practiceCouplePhotoUrl(): string {
  return PRACTICE_COUPLE_PHOTO_PUBLIC_PATH;
}

/**
 * Attach the practice couple photo to the sample relationship so the Client
 * portal hero shows a personalized photo (same presentation model as Olivia & James).
 */
export async function seedPracticeCouplePhoto(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  venueId: string,
  relationshipId: string | null | undefined,
): Promise<boolean> {
  if (!relationshipId) return false;
  const photoUrl = practiceCouplePhotoUrl();
  const { error } = await client
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
