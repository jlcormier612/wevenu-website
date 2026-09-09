"use server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { acceptOfferByToken } from "@/lib/booking-journey/offer";
import { maybeStampCommercialBookedAt } from "@/lib/booking-journey/stamp-commercial-booked-at";

export async function acceptOfferAction(
  token: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await acceptOfferByToken(token);
  if (!result.ok) return result;

  const admin = createAdminClient();
  const { data } = await admin
    .from("commercial_selections")
    .select("venue_id, client_id, event_id")
    .eq("accept_token", token)
    .maybeSingle<{ venue_id: string; client_id: string | null; event_id: string | null }>();
  if (data?.client_id && data.venue_id) {
    await maybeStampCommercialBookedAt(admin, data.venue_id, {
      clientId: data.client_id,
      eventId: data.event_id,
    });
  }
  return { ok: true };
}
