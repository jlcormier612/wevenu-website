/**
 * Venue data access (database layer).
 *
 * The ONLY place that talks to the venue tables. Maps database rows to/from the
 * domain model and calls the atomic `complete_venue_setup` RPC. Server-only —
 * imported exclusively by the application service layer.
 */
import { createClient } from "@/integrations/supabase/server";
import type { Venue, VenueSetupInput } from "@/lib/venue/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

/** Database row shape for `public.venues` (snake_case). */
type VenueRow = {
  id: string;
  owner_user_id: string;
  name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  venue_type: string | null;
  capacity: number | null;
  timezone: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  currency: string;
  week_starts_on: number;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  stripe_onboarding_status: Venue["stripeOnboardingStatus"];
  setup_completed: boolean;
  setup_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapVenue(r: VenueRow): Venue {
  return {
    id: r.id,
    ownerUserId: r.owner_user_id,
    name: r.name,
    businessName: r.business_name,
    email: r.email,
    phone: r.phone,
    website: r.website,
    addressLine1: r.address_line1,
    addressLine2: r.address_line2,
    city: r.city,
    stateRegion: r.state_region,
    postalCode: r.postal_code,
    country: r.country,
    venueType: r.venue_type,
    capacity: r.capacity,
    timezone: r.timezone,
    logoUrl: r.logo_url,
    primaryColor: r.primary_color,
    secondaryColor: r.secondary_color,
    currency: r.currency,
    weekStartsOn: r.week_starts_on,
    stripeAccountId: r.stripe_account_id,
    stripeChargesEnabled: r.stripe_charges_enabled,
    stripeOnboardingStatus: r.stripe_onboarding_status,
    setupCompleted: r.setup_completed,
    setupCompletedAt: r.setup_completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function normalizeUrl(value: string): string {
  const v = value.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/** Shape the validated input into the JSON payload the RPC expects. */
function toSetupPayload(input: VenueSetupInput) {
  return {
    name: input.name.trim(),
    business_name: input.businessName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    website: normalizeUrl(input.website),
    address_line1: input.addressLine1.trim(),
    address_line2: input.addressLine2.trim(),
    city: input.city.trim(),
    state_region: input.stateRegion.trim(),
    postal_code: input.postalCode.trim(),
    country: input.country.trim(),
    venue_type: input.venueType,
    capacity: input.capacity.trim(),
    timezone: input.timezone,
    logo_url: input.logoUrl.trim(),
    primary_color: input.primaryColor,
    secondary_color: input.secondaryColor,
    currency: input.currency,
    week_starts_on: input.weekStartsOn,
    stripe_onboarding_status: input.stripeOnboardingStatus,
    business_hours: input.businessHours.map((h) => ({
      day_of_week: h.dayOfWeek,
      is_open: h.isOpen,
      open_time: h.isOpen ? h.openTime : "",
      close_time: h.isOpen ? h.closeTime : "",
    })),
    owner: {
      full_name: input.ownerFullName.trim(),
      email: input.ownerEmail.trim(),
      title: input.ownerTitle.trim(),
    },
  };
}

/** Returns the current user's venue (RLS-scoped) or null. */
export async function getVenueForCurrentUser(
  client: DbClient,
): Promise<Venue | null> {
  const { data, error } = await client
    .from("venues")
    .select("*")
    .maybeSingle<VenueRow>();
  if (error) throw error;
  return data ? mapVenue(data) : null;
}

/** Atomically persists the whole setup payload; returns the new venue id. */
export async function insertVenueSetup(
  client: DbClient,
  input: VenueSetupInput,
): Promise<string> {
  const { data, error } = await client.rpc("complete_venue_setup", {
    payload: toSetupPayload(input),
  });
  if (error) throw error;
  return data as string;
}
