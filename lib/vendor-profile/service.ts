/**
 * Vendor profile service. Server-only.
 * Handles profile reads/updates for authenticated vendor users.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorHealthScore } from "@/lib/vendor-health/service";
import { getPendingTaskCount } from "@/lib/vendor-tasks/service";
import type {
  VendorActionResult,
  VendorDashboardData,
  VendorProfile,
  VendorProfileInput,
} from "@/lib/vendors/types";

async function withVendor<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, vendorId: string) => Promise<T>,
): Promise<T | VendorActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const vendorUser = await getVendorUser();
  if (!vendorUser) return { ok: false, message: "No vendor account found." };
  const supabase = await createClient();
  return fn(supabase, vendorUser.vendorId);
}

/** Luv Experience Completion, Work Stream 5 — one-time intro, never shown again. */
export async function markVendorLuvIntroSeen(): Promise<void> {
  await withVendor(async (supabase, vendorId) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("vendors") as any)
      .update({ luv_intro_seen_at: new Date().toISOString() })
      .eq("id", vendorId);
    return { ok: true } as VendorActionResult;
  });
}

/**
 * Update the vendor logo URL immediately after upload (or clear it when
 * url is null) — mirrors lib/venue/service.ts's updateVenueLogo() exactly.
 * A dedicated, narrow write so uploading a logo doesn't also flush
 * whatever else is sitting unsaved in the rest of the Profile form, and so
 * the logo actually persists without a separate "Save Profile" click
 * (2026-07-23: uploads were landing in Supabase Storage successfully but
 * only ever staged into the form's local state — vendors.logo_url stayed
 * null until Save was clicked, and was silently lost if the form
 * unmounted first).
 */
export async function updateVendorLogo(url: string | null): Promise<VendorActionResult> {
  const result = await withVendor(async (supabase, vendorId) => {
    const { error } = await supabase
      .from("vendors")
      .update({ logo_url: url })
      .eq("id", vendorId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function getVendorProfile(vendorId: string): Promise<VendorProfile | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", vendorId)
    .maybeSingle();
  if (!data) return null;
  return mapVendorProfile(data);
}

export async function updateVendorProfile(input: VendorProfileInput): Promise<VendorActionResult> {
  const result = await withVendor(async (supabase, vendorId) => {
    const { error } = await supabase
      .from("vendors")
      .update({
        business_name:        input.businessName.trim(),
        category:             input.category || null,
        description:          input.description || null,
        contact_name:         input.contactName || null,
        email:                input.email || null,
        phone:                input.phone || null,
        website_url:          input.websiteUrl || null,
        instagram_url:        input.instagramUrl || null,
        facebook_url:         input.facebookUrl || null,
        pinterest_url:        input.pinterestUrl || null,
        tiktok_url:           input.tiktokUrl || null,
        logo_url:             input.logoUrl || null,
        service_area:         input.serviceArea || null,
        pricing_tier:         input.pricingTier || null,
        insurance_expiry:     input.insuranceExpiry || null,
        is_marketplace_listed: input.isMarketplaceListed,
        accepting_inquiries:  input.acceptingInquiries,
        availability_notes:   input.availabilityNotes || null,
      })
      .eq("id", vendorId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function getVendorDashboardData(vendorId: string): Promise<VendorDashboardData | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);

  // Sprint 2 — Vendor Certification Pass. This used to read
  // event_vendor_assignments directly through the caller's RLS-scoped
  // session, the same defect fixed elsewhere in lib/vendor-events/
  // service.ts: that table's RLS never recognizes a vendor session, so the
  // Dashboard's "upcoming events" section returned empty for every real
  // vendor. Goes through get_vendor_events (the same RPC the vendor Events
  // list now uses) instead of adding a fourth near-duplicate query shape.
  const eventsRpc = supabase.rpc("get_vendor_events");

  const [profileRes, eventsRpcRes, venuesRes, pkgRes, availRes, newInquiryRes] = await Promise.all([
    supabase.from("vendors").select("*").eq("id", vendorId).maybeSingle(),
    eventsRpc,
    supabase
      .from("venue_vendor_relationships")
      .select("id, venue_id, status, added_at, venues(name)")
      .eq("vendor_id", vendorId)
      .neq("status", "removed")
      .order("added_at", { ascending: false }),
    supabase
      .from("vendor_packages")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendorId)
      .eq("is_active", true),
    supabase
      .from("vendor_availability")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendorId)
      .eq("is_blocked", true)
      .gte("date", today),
    supabase
      .from("vendor_inquiries")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendorId)
      .eq("status", "new"),
  ]);

  if (!profileRes.data) return null;

  const [pendingTaskCount, healthScore] = await Promise.all([
    getPendingTaskCount(vendorId),
    getVendorHealthScore(vendorId),
  ]);

  type EventsRpcRow = {
    assignment_id: string; event_id: string; event_name: string; event_date: string | null;
    event_end_date: string | null;
    venue_name: string; arrival_time: string | null;
  };
  const eventsRpcData = eventsRpcRes.data as { events?: EventsRpcRow[] } | { error: string } | null;
  const eventsRpcRows = eventsRpcData && "events" in eventsRpcData ? eventsRpcData.events ?? [] : [];

  const upcomingEvents = eventsRpcRows
    .filter((r) => {
      const end = r.event_end_date && r.event_date && r.event_end_date > r.event_date
        ? r.event_end_date
        : r.event_date;
      return end != null && end >= today;
    })
    .sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""))
    .slice(0, 10)
    .map((r) => ({
      id:          r.assignment_id,
      eventId:     r.event_id,
      eventName:   r.event_name,
      eventDate:   r.event_date,
      eventEndDate: r.event_end_date,
      venueName:   r.venue_name,
      arrivalTime: r.arrival_time,
    }));

  type VVRRow = {
    id: string;
    venue_id: string;
    status: string;
    added_at: string;
    venues: { name: string } | null;
  };

  const venues = ((venuesRes.data ?? []) as unknown as VVRRow[]).map((r) => ({
    id:        r.id,
    venueId:   r.venue_id,
    venueName: r.venues?.name ?? "Unknown Venue",
    status:    r.status,
    addedAt:   r.added_at,
  }));

  return {
    vendor:           mapVendorProfile(profileRes.data),
    upcomingEvents,
    venues,
    packageCount:     pkgRes.count ?? 0,
    blockedDateCount: availRes.count ?? 0,
    newInquiryCount:  newInquiryRes.count ?? 0,
    pendingTaskCount,
    healthScore,
  };
}

function mapVendorProfile(d: Record<string, unknown>): VendorProfile {
  return {
    id:                   d.id as string,
    businessName:         d.business_name as string,
    category:             (d.category as string | null) ?? null,
    description:          (d.description as string | null) ?? null,
    contactName:          (d.contact_name as string | null) ?? null,
    email:                (d.email as string | null) ?? null,
    phone:                (d.phone as string | null) ?? null,
    websiteUrl:           (d.website_url as string | null) ?? null,
    instagramUrl:         (d.instagram_url as string | null) ?? null,
    facebookUrl:          (d.facebook_url as string | null) ?? null,
    pinterestUrl:         (d.pinterest_url as string | null) ?? null,
    tiktokUrl:            (d.tiktok_url as string | null) ?? null,
    logoUrl:              (d.logo_url as string | null) ?? null,
    heroImageUrl:         (d.hero_image_url as string | null) ?? null,
    coverImageUrl:        (d.cover_image_url as string | null) ?? null,
    serviceArea:          (d.service_area as string | null) ?? null,
    insuranceExpiry:      (d.insurance_expiry as string | null) ?? null,
    pricingTier:          (d.pricing_tier ?? null) as VendorProfile["pricingTier"],
    profileSlug:          (d.profile_slug as string | null) ?? null,
    isMarketplaceListed:  Boolean(d.is_marketplace_listed),
    averageRating:        (d.average_rating as number | null) ?? null,
    reviewCount:          (d.review_count as number) ?? 0,
    subscriptionTier:     (d.subscription_tier ?? null) as VendorProfile["subscriptionTier"],
    subscriptionStatus:   (d.subscription_status ?? null) as VendorProfile["subscriptionStatus"],
    trialEndsAt:          (d.trial_ends_at as string | null) ?? null,
    isClaimed:            Boolean(d.is_claimed),
    acceptingInquiries:   d.accepting_inquiries !== false,
    availabilityNotes:    (d.availability_notes as string | null) ?? null,
    luvIntroSeenAt:       (d.luv_intro_seen_at as string | null) ?? null,
    createdAt:            d.created_at as string,
    updatedAt:            d.updated_at as string,
  };
}
