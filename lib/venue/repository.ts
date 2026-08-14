/**
 * Venue data access (database layer).
 *
 * The ONLY place that talks to the venue tables. Maps database rows to/from the
 * domain model and calls the atomic `complete_venue_setup` RPC. Server-only —
 * imported exclusively by the application service layer.
 */
import { createClient } from "@/integrations/supabase/server";
import { DAYS_OF_WEEK } from "@/lib/venue/constants";
import type {
  BusinessHourInput,
  Venue,
  VenueSetupInput,
} from "@/lib/venue/types";

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
  hero_image_url: string | null;
  story: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  neutral_color: string;
  public_review_url: string | null;
  currency: string;
  week_starts_on: number;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  stripe_charges_enabled_verified_at: string | null;
  stripe_onboarding_status: Venue["stripeOnboardingStatus"];
  stripe_accepted_payment_methods: Venue["stripeAcceptedPaymentMethods"];
  setup_completed: boolean;
  setup_completed_at: string | null;
  setup_last_step: string | null;
  onboarding_persona: Venue["onboardingPersona"];
  onboarding_dismissed: boolean;
  luv_intro_seen_at: string | null;
  embed_key: string;
  lead_email_key: string;
  tour_scheduling_enabled: boolean;
  conversation_experience_enabled: boolean;
  event_order_enabled: boolean;
  access_disabled: boolean | null;
  account_status: "active" | "suspended" | null;
  saas_stripe_customer_id: string | null;
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
    heroImageUrl: r.hero_image_url,
    story: r.story,
    primaryColor: r.primary_color,
    secondaryColor: r.secondary_color,
    accentColor: r.accent_color ?? "#B8AEA1",
    neutralColor: r.neutral_color ?? "#F7F5F1",
    publicReviewUrl: r.public_review_url ?? null,
    currency: r.currency,
    weekStartsOn: r.week_starts_on,
    stripeAccountId: r.stripe_account_id,
    stripeChargesEnabled: r.stripe_charges_enabled,
    stripeChargesEnabledVerifiedAt: r.stripe_charges_enabled_verified_at,
    stripeOnboardingStatus: r.stripe_onboarding_status,
    stripeAcceptedPaymentMethods: r.stripe_accepted_payment_methods ?? ["card"],
    setupCompleted: r.setup_completed,
    setupCompletedAt: r.setup_completed_at,
    setupLastStep: r.setup_last_step ?? null,
    onboardingPersona: r.onboarding_persona ?? null,
    onboardingDismissed: r.onboarding_dismissed,
    luvIntroSeenAt: r.luv_intro_seen_at,
    embedKey: r.embed_key ?? "",
    leadEmailKey: r.lead_email_key ?? "",
    tourSchedulingEnabled: r.tour_scheduling_enabled ?? false,
    conversationExperienceEnabled: r.conversation_experience_enabled ?? false,
    eventOrderEnabled: r.event_order_enabled ?? false,
    accessDisabled: r.access_disabled === true,
    accountStatus: r.account_status === "suspended" ? "suspended" : "active",
    saasStripeCustomerId: r.saas_stripe_customer_id ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function normalizeVenueUrl(value: string): string {
  const v = value.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/** Shape the validated input into the JSON payload the RPC expects. */
function toSetupPayload(input: VenueSetupInput, completed: boolean, lastStep?: string) {
  return {
    onboarding_persona: input.onboardingPersona ?? undefined,
    setup_completed: completed,
    setup_last_step: lastStep,
    name: input.name.trim(),
    business_name: input.businessName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    website: normalizeVenueUrl(input.website),
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
    accent_color: input.accentColor,
    neutral_color: input.neutralColor,
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

/**
 * Returns the current user's own venue, or null.
 *
 * Explicitly scoped via current_user_venue_id() (the same RPC the venues_select
 * RLS policy itself uses) rather than a bare `select *` relying on RLS alone
 * to narrow the result to one row. RLS also has a second, broader policy
 * (venues_hq_select — any HQ admin can see every venue) that's correct on its
 * own terms but is OR'd together with venues_select, so an unfiltered query
 * from an account that's *both* a venue owner and an HQ admin legitimately
 * matches every venue in the database and PGRST116s instead of returning one
 * row (confirmed 2026-08-04: a dev seed account had a stray hq_admins grant
 * left over from unrelated testing, breaking /dashboard and /clients for it).
 * Filtering by id here makes this function correct regardless of what else a
 * user is separately permitted to see.
 */
export async function getVenueForCurrentUser(
  client: DbClient,
): Promise<Venue | null> {
  const { data: venueId, error: idError } = await client.rpc("current_user_venue_id");
  if (idError) throw idError;
  if (!venueId) return null;
  const { data, error } = await client
    .from("venues")
    .select("*")
    .eq("id", venueId)
    .maybeSingle<VenueRow>();
  if (error) throw error;
  return data ? mapVenue(data) : null;
}

/**
 * Atomically upserts the setup payload; returns the venue id. `completed`
 * controls whether this is a final "Create venue" submit (true) or a
 * mid-wizard progress save (false) — setup_completed is sticky once true,
 * enforced in complete_venue_setup() itself, so a stale progress save can
 * never un-complete an already-finished venue.
 */
export async function insertVenueSetup(
  client: DbClient,
  input: VenueSetupInput,
  completed: boolean = true,
  lastStep?: string,
): Promise<string> {
  const { data, error } = await client.rpc("complete_venue_setup", {
    payload: toSetupPayload(input, completed, lastStep),
  });
  if (error) throw error;
  return data as string;
}

// ---- Settings data access ---------------------------------------------------

export type VenueFullDetails = {
  venue: Venue;
  hours: BusinessHourInput[];
  ownerName: string;
  ownerTitle: string;
  ownerEmail: string;
};

/**
 * Loads the venue, all business-hours rows, and the owner staff record in
 * three round-trips. Used exclusively by the Settings page.
 */
export async function getVenueFullDetails(
  client: DbClient,
): Promise<VenueFullDetails | null> {
  const venue = await getVenueForCurrentUser(client);
  if (!venue) return null;

  const { data: hourRows, error: hoursErr } = await client
    .from("venue_business_hours")
    .select("day_of_week, is_open, open_time, close_time")
    .eq("venue_id", venue.id)
    .order("day_of_week");
  if (hoursErr) throw hoursErr;

  const { data: ownerRow, error: staffErr } = await client
    .from("venue_staff")
    .select("full_name, title, email")
    .eq("venue_id", venue.id)
    .eq("is_owner", true)
    .maybeSingle<{ full_name: string; title: string | null; email: string | null }>();
  if (staffErr) throw staffErr;

  const byDay = new Map(
    (hourRows ?? []).map((r) => [
      r.day_of_week as number,
      {
        dayOfWeek: r.day_of_week as number,
        isOpen: r.is_open as boolean,
        openTime: ((r.open_time as string | null) ?? "").slice(0, 5),
        closeTime: ((r.close_time as string | null) ?? "").slice(0, 5),
      } satisfies BusinessHourInput,
    ]),
  );

  // Guarantee all 7 days are present; fill missing with sensible defaults.
  const hours = DAYS_OF_WEEK.map(
    (d) =>
      byDay.get(d.value) ?? {
        dayOfWeek: d.value,
        isOpen: d.value !== 1,
        openTime: "09:00",
        closeTime: "22:00",
      },
  );

  return {
    venue,
    hours,
    ownerName: ownerRow?.full_name ?? "",
    ownerTitle: ownerRow?.title ?? "",
    ownerEmail: ownerRow?.email ?? "",
  };
}

/** Update arbitrary columns on the owning user's venue row (RLS enforced). */
export async function updateVenueFields(
  client: DbClient,
  venueId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("venues") as any)
    .update(patch)
    .eq("id", venueId);
  if (error) throw error;
}

/** Upsert all seven business-hours rows (RLS enforced via venue ownership). */
export async function upsertBusinessHours(
  client: DbClient,
  venueId: string,
  hours: BusinessHourInput[],
): Promise<void> {
  const rows = hours.map((h) => ({
    venue_id: venueId,
    day_of_week: h.dayOfWeek,
    is_open: h.isOpen,
    open_time: h.isOpen && h.openTime ? h.openTime : null,
    close_time: h.isOpen && h.closeTime ? h.closeTime : null,
  }));
  const { error } = await client
    .from("venue_business_hours")
    .upsert(rows, { onConflict: "venue_id,day_of_week" });
  if (error) throw error;
}

/** Update the venue's owner staff record (name, title, email). */
export async function updateOwnerStaff(
  client: DbClient,
  venueId: string,
  patch: { full_name: string; title: string | null; email: string | null },
): Promise<void> {
  const { error } = await client
    .from("venue_staff")
    .update(patch)
    .eq("venue_id", venueId)
    .eq("is_owner", true);
  if (error) throw error;
}
