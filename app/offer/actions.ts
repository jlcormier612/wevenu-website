"use server";

import { acceptOfferByToken } from "@/lib/booking-journey/offer";

export async function acceptOfferAction(
  token: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await acceptOfferByToken(token);
  if (!result.ok) return result;
  return { ok: true };
}
