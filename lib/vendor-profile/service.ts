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

  const [profileRes, eventsRes, venuesRes, pkgRes, availRes, newInquiryRes] = await Promise.all([
    supabase.from("vendors").select("*").eq("id", vendorId).maybeSingle(),
    supabase
      .from("event_vendor_assignments")
      .select("id, event_id, arrival_time, events(id, name, event_date, venues(name))")
      .eq("vendor_id", vendorId)
      .gte("events.event_date", today)
      .order("events(event_date)", { ascending: true })
      .limit(10),
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

  type EVARow = {
    id: string;
    event_id: string;
    arrival_time: string | null;
    events: { id: string; name: string; event_date: string | null; venues: { name: string } | null } | null;
  };

  const upcomingEvents = ((eventsRes.data ?? []) as unknown as EVARow[])
    .filter((r) => r.events?.event_date && r.events.event_date >= today)
    .map((r) => ({
      id:          r.id,
      eventId:     r.event_id,
      eventName:   r.events?.name ?? "Unnamed Event",
      eventDate:   r.events?.event_date ?? null,
      venueName:   r.events?.venues?.name ?? "Unknown Venue",
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
    createdAt:            d.created_at as string,
    updatedAt:            d.updated_at as string,
  };
}
