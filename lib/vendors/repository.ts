/**
 * Vendor data access layer. Server-only.
 * Sprint 104.5: vendors is now global; venue-specific state is in
 * venue_vendor_relationships. getVendors/getVendor join through the
 * relationship to return the flat Vendor shape the UI expects.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  EventVendorAssignment,
  Vendor,
  VendorAssignmentInput,
  VendorEventSummary,
  VendorInput,
  VendorReview,
  VendorReviewInput,
  VendorWithEvents,
} from "@/lib/vendors/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

// Raw DB row shapes ────────────────────────────────────────────────────────────

type VendorRow = {
  id: string; business_name: string; category: string | null;
  description: string | null; contact_name: string | null;
  email: string | null; phone: string | null; website_url: string | null;
  instagram_url: string | null; facebook_url: string | null;
  pinterest_url: string | null; tiktok_url: string | null;
  logo_url: string | null; hero_image_url: string | null; cover_image_url: string | null;
  service_area: string | null; insurance_expiry: string | null;
  pricing_tier: string | null; profile_slug: string | null;
  is_marketplace_listed: boolean; average_rating: number | null; review_count: number;
  subscription_tier: string | null; subscription_status: string | null; trial_ends_at: string | null;
  is_claimed: boolean; created_at: string; updated_at: string;
  accepting_inquiries: boolean; availability_notes: string | null;
};

type VVRRow = {
  venue_id: string; vendor_id: string; status: string;
  preference_level: string; display_order: number;
  notes: string | null; special_pricing_note: string | null;
  added_at: string; updated_at: string;
  vendors: VendorRow | null;
};

type VendorReviewRow = {
  id: string; vendor_id: string; reviewer_type: string; venue_id: string | null;
  event_id: string | null; client_id: string | null; rating: number;
  body: string | null; is_public: boolean; created_at: string;
  events?: { name: string } | null;
};

type EVARow = {
  id: string; venue_id: string; event_id: string; vendor_id: string;
  arrival_time: string | null; setup_location: string | null; load_in_notes: string | null;
  notes: string | null; created_at: string;
  checked_in_at: string | null; setup_complete_at: string | null;
  vendors: { business_name: string; category: string | null; contact_name: string | null; phone: string | null } | null;
};

type EVAEventRow = {
  id: string; event_id: string; arrival_time: string | null;
  events: { name: string; event_date: string | null } | null;
};

// Mappers ─────────────────────────────────────────────────────────────────────

function mapVendorProfile(r: VendorRow) {
  return {
    id:                  r.id,
    businessName:        r.business_name,
    category:            r.category,
    description:         r.description,
    contactName:         r.contact_name,
    email:               r.email,
    phone:               r.phone,
    websiteUrl:          r.website_url,
    instagramUrl:        r.instagram_url,
    facebookUrl:         r.facebook_url,
    pinterestUrl:        r.pinterest_url,
    tiktokUrl:           r.tiktok_url,
    logoUrl:             r.logo_url,
    heroImageUrl:        r.hero_image_url,
    coverImageUrl:       r.cover_image_url,
    serviceArea:         r.service_area,
    insuranceExpiry:     r.insurance_expiry,
    pricingTier:         (r.pricing_tier ?? null) as import("./types").VendorPricingTier | null,
    profileSlug:         r.profile_slug,
    isMarketplaceListed: r.is_marketplace_listed,
    averageRating:       r.average_rating,
    reviewCount:         r.review_count,
    subscriptionTier:    (r.subscription_tier ?? null) as import("./types").VendorSubscriptionTier | null,
    subscriptionStatus:  (r.subscription_status ?? null) as import("./types").VendorSubscriptionStatus | null,
    trialEndsAt:         r.trial_ends_at,
    isClaimed:           r.is_claimed,
    acceptingInquiries:  r.accepting_inquiries !== false,
    availabilityNotes:   r.availability_notes ?? null,
    createdAt:           r.created_at,
    updatedAt:           r.updated_at,
  };
}

function mapVVR(r: VVRRow): Vendor | null {
  if (!r.vendors) return null;
  const preferenceLevel = (r.preference_level ?? "recommended") as import("./types").VendorPreferenceLevel;
  return {
    ...mapVendorProfile(r.vendors),
    venueId:            r.venue_id,
    status:             (r.status as import("./types").VendorRelationshipStatus) ?? "active",
    // Computed convenience, not a second independently-writable fact (Standard #1) —
    // preferenceLevel alone is the one owner of "how prominently featured."
    isPreferred:        preferenceLevel !== "recommended",
    preferenceLevel,
    displayOrder:       r.display_order ?? 0,
    notes:              r.notes,
    specialPricingNote: r.special_pricing_note,
  };
}

function mapEVA(r: EVARow): EventVendorAssignment {
  return {
    id:              r.id,
    venueId:         r.venue_id,
    eventId:         r.event_id,
    vendorId:        r.vendor_id,
    vendorName:      r.vendors?.business_name ?? "Unknown vendor",
    vendorCategory:  r.vendors?.category ?? null,
    vendorPhone:     r.vendors?.phone ?? null,
    arrivalTime:     r.arrival_time?.slice(0, 5) ?? null,
    setupLocation:   r.setup_location ?? null,
    loadInNotes:     r.load_in_notes ?? null,
    notes:           r.notes,
    checkedInAt:     r.checked_in_at ?? null,
    setupCompleteAt: r.setup_complete_at ?? null,
    createdAt:       r.created_at,
  };
}

// ── Vendor directory ──────────────────────────────────────────────────────────

export async function getVendors(client: DbClient, venueId: string): Promise<Vendor[]> {
  const { data, error } = await client
    .from("venue_vendor_relationships")
    .select("*, vendors(*)")
    .eq("venue_id", venueId)
    .neq("status", "inactive")
    // "featured" < "preferred" < "recommended" alphabetically happens to match
    // the intended priority order, so no CASE expression is needed here.
    .order("preference_level", { ascending: true })
    .order("display_order",    { ascending: true })
    .order("vendors(business_name)", { ascending: true });
  if (error) throw error;
  return (data as VVRRow[]).flatMap((r) => {
    const v = mapVVR(r);
    return v ? [v] : [];
  });
}

export async function getVendor(client: DbClient, venueId: string, vendorId: string): Promise<VendorWithEvents | null> {
  const [vvrRes, aRes] = await Promise.all([
    client
      .from("venue_vendor_relationships")
      .select("*, vendors(*)")
      .eq("venue_id", venueId)
      .eq("vendor_id", vendorId)
      .maybeSingle<VVRRow>(),
    client
      .from("event_vendor_assignments")
      .select("id, event_id, arrival_time, events(name, event_date)")
      .eq("vendor_id", vendorId)
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (vvrRes.error) throw vvrRes.error;
  if (aRes.error)   throw aRes.error;
  if (!vvrRes.data)  return null;
  const vendor = mapVVR(vvrRes.data);
  if (!vendor) return null;
  const assignments: VendorEventSummary[] = (aRes.data as unknown as EVAEventRow[]).map((r) => ({
    id:          r.id,
    eventId:     r.event_id,
    eventName:   (r.events as { name: string } | null)?.name ?? "Unknown event",
    eventDate:   (r.events as { event_date: string | null } | null)?.event_date ?? null,
    arrivalTime: r.arrival_time?.slice(0, 5) ?? null,
  }));
  return { ...vendor, assignments };
}

function toVendorProfileRow(input: VendorInput): Record<string, unknown> {
  return {
    business_name:  input.businessName.trim(),
    category:       input.category || null,
    contact_name:   input.contactName.trim() || null,
    email:          input.email.trim() || null,
    phone:          input.phone.trim() || null,
    website_url:    input.websiteUrl.trim() || null,
    instagram_url:  input.instagramUrl.trim() || null,
    facebook_url:   input.facebookUrl.trim() || null,
    pinterest_url:  input.pinterestUrl.trim() || null,
    tiktok_url:     input.tiktokUrl.trim() || null,
    description:    input.description.trim() || null,
    logo_url:       input.logoUrl.trim() || null,
    pricing_tier:   input.pricingTier || null,
  };
}

export async function insertVendor(client: DbClient, venueId: string, input: VendorInput): Promise<string> {
  // The global vendor profile and the venue relationship used to be two
  // separate inserts — if the second failed, the first had already
  // committed, leaving an orphaned global vendor profile with no venue
  // relationship pointing at it. Same bug shape confirmed and fixed for
  // Leads and Clients; this is the identical fix for Vendors. venueId
  // isn't passed to the RPC — it resolves itself via
  // current_user_venue_id(), the same RLS-backed source of truth every
  // policy on these tables uses.
  const { data, error } = await client.rpc("create_vendor_atomic", {
    payload: {
      businessName: input.businessName.trim(),
      category: input.category,
      contactName: input.contactName.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      websiteUrl: input.websiteUrl.trim(),
      instagramUrl: input.instagramUrl.trim(),
      facebookUrl: input.facebookUrl.trim(),
      pinterestUrl: input.pinterestUrl.trim(),
      tiktokUrl: input.tiktokUrl.trim(),
      logoUrl: input.logoUrl.trim(),
      description: input.description.trim(),
      pricingTier: input.pricingTier,
      preferenceLevel: input.preferenceLevel,
      notes: input.notes.trim(),
      specialPricingNote: input.specialPricingNote.trim(),
    },
  });
  if (error) throw error;
  return data as string;
}

/**
 * Identity fields (name, category, pricing, etc.) are only written while the
 * vendor is unclaimed — once claimed, identity belongs to the vendor's own
 * account and RLS (venues_update_unclaimed_vendors) would reject it anyway.
 * Checking here first gives the venue a clear message instead of a silent
 * no-op (Engineering Standard #3 — enforcement in the service layer, RLS as
 * the backstop, not the only layer).
 */
export async function updateVendor(client: DbClient, venueId: string, vendorId: string, input: VendorInput): Promise<{ identityUpdated: boolean }> {
  const { data: vendorRow, error: fetchErr } = await client
    .from("vendors").select("is_claimed").eq("id", vendorId).maybeSingle<{ is_claimed: boolean }>();
  if (fetchErr) throw fetchErr;
  const isClaimed = vendorRow?.is_claimed ?? true; // fail closed if the vendor can't be found

  const writes: Promise<{ error: unknown }>[] = [
    Promise.resolve(
      client.from("venue_vendor_relationships")
        .update({
          preference_level:     input.preferenceLevel || "recommended",
          notes:                input.notes.trim() || null,
          special_pricing_note: input.specialPricingNote.trim() || null,
        })
        .eq("venue_id", venueId).eq("vendor_id", vendorId),
    ).then(r => ({ error: r.error })),
  ];
  if (!isClaimed) {
    writes.push(
      Promise.resolve(client.from("vendors").update(toVendorProfileRow(input)).eq("id", vendorId))
        .then(r => ({ error: r.error })),
    );
  }

  const results = await Promise.all(writes);
  for (const r of results) if (r.error) throw r.error;
  return { identityUpdated: !isClaimed };
}

/** Soft-delete: marks the venue relationship as inactive. Vendor profile stays global. */
export async function deleteVendor(client: DbClient, venueId: string, vendorId: string): Promise<void> {
  const { error } = await client
    .from("venue_vendor_relationships")
    .update({ status: "inactive" })
    .eq("venue_id", venueId)
    .eq("vendor_id", vendorId);
  if (error) throw error;
}

/** Reactivate an inactive relationship — one click back, per "inactive is a pause, not a deletion." */
export async function reactivateVendor(client: DbClient, venueId: string, vendorId: string): Promise<void> {
  const { error } = await client
    .from("venue_vendor_relationships")
    .update({ status: "active" })
    .eq("venue_id", venueId)
    .eq("vendor_id", vendorId)
    .eq("status", "inactive");
  if (error) throw error;
}

// ── Reviews ────────────────────────────────────────────────────────────────────
// Reuses the existing vendor_reviews model (rating, body, reviewer_type, RLS
// already in place) per the approved "reuse before creating" direction — this
// is the first real reader/writer, not a new mechanism.

export async function getVendorReviews(client: DbClient, venueId: string, vendorId: string): Promise<VendorReview[]> {
  const { data, error } = await client
    .from("vendor_reviews")
    .select("*, events(name)")
    .eq("vendor_id", vendorId)
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as VendorReviewRow[]).map((r) => ({
    id:           r.id,
    vendorId:     r.vendor_id,
    reviewerType: r.reviewer_type as VendorReview["reviewerType"],
    venueId:      r.venue_id,
    eventId:      r.event_id,
    clientId:     r.client_id,
    rating:       r.rating,
    body:         r.body,
    isPublic:     r.is_public,
    createdAt:    r.created_at,
    eventName:    r.events?.name ?? null,
  }));
}

export async function insertVendorReview(client: DbClient, venueId: string, vendorId: string, input: VendorReviewInput): Promise<void> {
  const { error } = await client.from("vendor_reviews").insert({
    vendor_id:     vendorId,
    venue_id:      venueId,
    reviewer_type: "venue",
    event_id:      input.eventId || null,
    rating:        input.rating,
    body:          input.body.trim() || null,
    is_public:     input.isPublic,
  });
  if (error) throw error;
}

// ── Event vendor assignments ──────────────────────────────────────────────────

export async function getEventVendorAssignments(
  client: DbClient, venueId: string, eventId: string,
): Promise<EventVendorAssignment[]> {
  const { data, error } = await client
    .from("event_vendor_assignments")
    .select("*, vendors(business_name, category, contact_name, phone)")
    .eq("event_id", eventId)
    .eq("venue_id", venueId)
    .order("arrival_time", { ascending: true, nullsFirst: false })
    .order("created_at",   { ascending: true });
  if (error) throw error;
  return (data as EVARow[]).map(mapEVA);
}

export async function insertVendorAssignment(
  client: DbClient, venueId: string, eventId: string, input: VendorAssignmentInput,
): Promise<EventVendorAssignment> {
  const { data, error } = await client
    .from("event_vendor_assignments")
    .insert({
      venue_id:       venueId,
      event_id:       eventId,
      vendor_id:      input.vendorId,
      arrival_time:   input.arrivalTime || null,
      setup_location: input.setupLocation.trim() || null,
      load_in_notes:  input.loadInNotes.trim() || null,
      notes:          input.notes.trim() || null,
    })
    .select("*, vendors(business_name, category, contact_name, phone)")
    .single<EVARow>();
  if (error) throw error;
  return mapEVA(data);
}

export async function deleteVendorAssignment(
  client: DbClient, venueId: string, assignmentId: string,
): Promise<void> {
  const { error } = await client
    .from("event_vendor_assignments")
    .delete().eq("id", assignmentId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function updateVendorAssignment(
  client: DbClient, venueId: string, assignmentId: string,
  input: { arrivalTime: string; setupLocation: string; loadInNotes: string; notes: string },
): Promise<void> {
  const { error } = await client
    .from("event_vendor_assignments")
    .update({
      arrival_time:   input.arrivalTime || null,
      setup_location: input.setupLocation.trim() || null,
      load_in_notes:  input.loadInNotes.trim() || null,
      notes:          input.notes.trim() || null,
    })
    .eq("id", assignmentId).eq("venue_id", venueId);
  if (error) throw error;
}
