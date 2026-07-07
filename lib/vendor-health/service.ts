import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { VendorHealthScore } from "@/lib/vendors/types";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function buildHealthScore(
  profile:      Record<string, unknown>,
  packageCount: number,
  hasAvailability: boolean,
  inquiries:    Array<{ status: string; created_at: string }>,
): VendorHealthScore {
  const now = new Date();
  const dims: VendorHealthScore["dimensions"] = {};
  const strengths: string[] = [];
  const gaps: string[] = [];

  // ── Profile completeness (20 pts) ────────────────────────────────────────
  const profileFields = [
    "business_name", "category", "description", "contact_name",
    "email", "phone", "pricing_tier", "service_area",
  ];
  const filled = profileFields.filter((f) => profile[f]).length;
  const profileScore = Math.round(filled * 2.5);
  dims.profile = { score: profileScore, label: "Profile Completeness", weight: 20 };
  if (profileScore >= 18) strengths.push("Profile is detailed and complete");
  else gaps.push(`Profile is ${filled}/8 complete — finish missing fields`);

  // ── Package completeness (15 pts) ─────────────────────────────────────────
  const pkgScore = packageCount >= 1 ? 15 : 0;
  dims.packages = { score: pkgScore, label: "Package Offerings", weight: 15 };
  if (pkgScore === 15) strengths.push("Packages are listed and visible to venues");
  else gaps.push("Add at least one active package so venues can see your offerings");

  // ── Insurance current (15 pts) ────────────────────────────────────────────
  const insuranceExpiry = profile.insurance_expiry as string | null;
  const insScore = insuranceExpiry && insuranceExpiry > now.toISOString().slice(0, 10) ? 15 : 0;
  dims.insurance = { score: insScore, label: "Insurance Current", weight: 15 };
  if (insScore === 15) {
    const daysLeft = Math.ceil(
      (new Date(insuranceExpiry!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysLeft < 30) gaps.push(`Insurance expires in ${daysLeft} days — renew soon`);
    else strengths.push("Insurance is current");
  } else {
    gaps.push("Add your insurance expiry date — venues require this");
  }

  // ── Availability freshness (10 pts) ───────────────────────────────────────
  const availScore = hasAvailability ? 10 : 0;
  dims.availability = { score: availScore, label: "Availability Updated", weight: 10 };
  if (availScore === 10) strengths.push("Availability calendar is up to date");
  else gaps.push("Mark blocked dates on your calendar so venues know your schedule");

  // ── Marketplace ready (10 pts) ────────────────────────────────────────────
  const mpScore = profile.is_marketplace_listed ? 10 : 0;
  dims.marketplace = { score: mpScore, label: "Marketplace Listed", weight: 10 };
  if (mpScore === 10) strengths.push("Listed on the Wevenu marketplace");
  else gaps.push("Enable marketplace listing to get discovered by more venues");

  // ── Inquiry momentum (30 pts) ─────────────────────────────────────────────
  // Neutral (15 pts) if < 3 inquiries (not penalized for being new)
  let momentumScore = 15;
  if (inquiries.length >= 3) {
    const booked   = inquiries.filter((i) => i.status === "booked").length;
    const active   = inquiries.filter((i) =>
      ["new", "contacted", "consultation_scheduled", "proposal_sent"].includes(i.status),
    ).length;
    const declined = inquiries.filter((i) => ["declined", "lost"].includes(i.status)).length;
    const total    = inquiries.length;

    // Conversion: booked / (booked + declined + lost) — 15 pts
    const closed = booked + declined;
    const convRate = closed > 0 ? booked / closed : 0.5;
    const convScore = Math.round(convRate * 15);

    // Timeliness: penalize stale "new" inquiries > 48h unresponded — 15 pts
    const staleNew = inquiries.filter((i) => {
      if (i.status !== "new") return false;
      const ageH = (now.getTime() - new Date(i.created_at).getTime()) / (1000 * 60 * 60);
      return ageH > 48;
    }).length;
    const timelinessScore = Math.max(0, 15 - staleNew * 5);

    momentumScore = convScore + timelinessScore;

    if (booked > 0) strengths.push(`${booked} booked ${booked === 1 ? "inquiry" : "inquiries"}`);
    if (active > 0) strengths.push(`${active} active ${active === 1 ? "inquiry" : "inquiries"} in pipeline`);
    if (staleNew > 0) gaps.push(`${staleNew} new ${staleNew === 1 ? "inquiry" : "inquiries"} waiting over 48 hours — respond to stay competitive`);
    if (convRate < 0.3 && closed >= 3) gaps.push("Conversion rate below 30% — consider following up faster with proposals");
    void total;
  } else if (inquiries.length === 0) {
    gaps.push("No inquiries yet — complete your profile and enable marketplace listing");
  }

  dims.momentum = { score: momentumScore, label: "Inquiry Momentum", weight: 30 };

  const score = Object.values(dims).reduce((sum, d) => sum + d.score, 0);
  const tier: VendorHealthScore["tier"] =
    score >= 85 ? "thriving" : score >= 65 ? "growing" : "needs_attention";

  const topGap = gaps[0] ?? null;
  const luvTip = topGap
    ? `✦ ${topGap}`
    : "Your business is in great shape — keep the momentum going!";

  return {
    score,
    tier,
    dimensions: dims,
    strengths:  strengths.slice(0, 3),
    gaps:       gaps.slice(0, 3),
    luvTip,
    computedAt: now.toISOString(),
  };
}

export async function computeVendorHealthScore(
  vendorId: string,
): Promise<VendorHealthScore | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const today    = new Date().toISOString().slice(0, 10);
  const in90     = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [profileRes, pkgRes, availRes, inquiryRes] = await Promise.all([
    supabase.from("vendors").select("*").eq("id", vendorId).maybeSingle(),
    supabase
      .from("vendor_packages")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendorId)
      .eq("is_active", true),
    supabase
      .from("vendor_availability")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendorId)
      .eq("is_blocked", false)
      .gte("date", today)
      .lte("date", in90),
    supabase
      .from("vendor_inquiries")
      .select("status, created_at")
      .eq("vendor_id", vendorId),
  ]);

  if (!profileRes.data) return null;

  const health = buildHealthScore(
    profileRes.data as Record<string, unknown>,
    pkgRes.count ?? 0,
    (availRes.count ?? 0) > 0,
    (inquiryRes.data ?? []) as Array<{ status: string; created_at: string }>,
  );

  await supabase.from("vendor_health_scores").upsert({
    vendor_id:  vendorId,
    score:      health.score,
    tier:       health.tier,
    dimensions: health.dimensions,
    strengths:  health.strengths,
    gaps:       health.gaps,
    luv_tip:    health.luvTip,
    computed_at: health.computedAt,
  });

  return health;
}

export async function getVendorHealthScore(
  vendorId: string,
): Promise<VendorHealthScore | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();

  const { data } = await supabase
    .from("vendor_health_scores")
    .select("*")
    .eq("vendor_id", vendorId)
    .maybeSingle();

  if (data) {
    const age = Date.now() - new Date(data.computed_at as string).getTime();
    if (age < CACHE_TTL_MS) {
      return {
        score:      data.score as number,
        tier:       data.tier as VendorHealthScore["tier"],
        dimensions: data.dimensions as VendorHealthScore["dimensions"],
        strengths:  data.strengths as string[],
        gaps:       data.gaps as string[],
        luvTip:     data.luv_tip as string | null,
        computedAt: data.computed_at as string,
      };
    }
  }

  return computeVendorHealthScore(vendorId);
}
