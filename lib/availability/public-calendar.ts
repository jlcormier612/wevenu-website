import { createClient } from "@/integrations/supabase/server";
import { monthBounds } from "@/lib/availability/public-calendar-month";
import { isSupabaseConfigured } from "@/lib/env";
import { venueToday } from "@/lib/venue/timezone";

export type PublicAvailabilityVenue = {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  timezone: string;
};

export type PublicAvailabilityMonth = {
  venue: PublicAvailabilityVenue;
  year: number;
  month: number;
  today: string;
  available: string[];
  token: string;
};

type RpcPayload = {
  ok?: boolean;
  error?: string;
  dates?: string[];
  venue?: {
    name?: string;
    logoUrl?: string | null;
    primaryColor?: string;
    timezone?: string;
  };
};

export async function loadPublicAvailability(
  token: string,
  year: number,
  month: number,
): Promise<PublicAvailabilityMonth | null> {
  const key = token.trim();
  if (!key || !isSupabaseConfigured) return null;
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;

  const { start, end } = monthBounds(year, month);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_availability_calendar", {
    p_embed_key: key,
    p_start: start,
    p_end: end,
  });
  if (error) return null;
  const payload = data as RpcPayload | null;
  if (!payload?.ok || !payload.venue?.name) return null;

  const timezone = payload.venue.timezone || "America/New_York";
  const available = Array.isArray(payload.dates)
    ? payload.dates.map((d) => String(d).slice(0, 10))
    : [];
  return {
    token: key,
    year,
    month,
    today: venueToday(timezone),
    available,
    venue: {
      name: payload.venue.name,
      logoUrl: payload.venue.logoUrl ?? null,
      primaryColor: payload.venue.primaryColor || "#5D6F5D",
      timezone,
    },
  };
}
