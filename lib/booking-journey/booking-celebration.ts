/**
 * One-shot booking celebration.
 *
 * `bookClient` sets `events.booking_celebration_pending` only when
 * `booked_at` changes from null to a timestamp. The celebration page
 * consumes that flag. A second visit, a repeated booking, or a payment
 * that did not book the client does not celebrate.
 */
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";

export async function bookingCelebrationPending(eventId: string): Promise<boolean> {
  const venue = await getCurrentVenue();
  if (!venue || !eventId) return false;
  const supabase = await createClient();
  // Column is added by migration 20261402500000; generated types lag the migration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("events") as any)
    .select("booking_celebration_pending, booked_at")
    .eq("id", eventId)
    .eq("venue_id", venue.id)
    .maybeSingle();
  return Boolean(data?.booking_celebration_pending && data?.booked_at);
}

/** Returns true exactly once per new booking. */
export async function consumeBookingCelebration(eventId: string): Promise<boolean> {
  const venue = await getCurrentVenue();
  if (!venue || !eventId) return false;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("events") as any)
    .update({ booking_celebration_pending: false })
    .eq("id", eventId)
    .eq("venue_id", venue.id)
    .eq("booking_celebration_pending", true)
    .not("booked_at", "is", null)
    .select("id");
  return Array.isArray(data) && data.length > 0;
}
