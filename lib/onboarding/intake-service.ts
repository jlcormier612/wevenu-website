/**
 * Persist and apply onboarding intake (Self-Setup + White Glove).
 * Applies safe defaults to the real venue — does not graduate the venue.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import type {
  BringBusinessChoice,
  InquirySourceKey,
  OnboardingIntakeInput,
  OnboardingIntakeRecord,
  SpaceMode,
  TastingAppointmentChoice,
} from "@/lib/onboarding/types";

type IntakeRow = {
  id: string;
  venue_id: string;
  enrollment_id: string | null;
  path: "self_setup" | "white_glove";
  venue_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  primary_contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  space_mode: SpaceMode | null;
  spaces: unknown;
  offers_tours: boolean | null;
  tasting_appointment_choice: TastingAppointmentChoice | null;
  inquiry_sources: string[] | null;
  inquiry_sources_other: string | null;
  bring_business_choice: BringBusinessChoice | null;
  starters_accepted_at: string | null;
  submitted_at: string | null;
};

function mapSpaces(raw: unknown): OnboardingIntakeInput["spaces"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => {
    const row = s as { name?: string; maxCapacity?: number | null; max_capacity?: number | null };
    return {
      name: String(row.name ?? "").trim() || "Main Space",
      maxCapacity:
        typeof row.maxCapacity === "number"
          ? row.maxCapacity
          : typeof row.max_capacity === "number"
            ? row.max_capacity
            : null,
    };
  });
}

function mapRow(r: IntakeRow): OnboardingIntakeRecord {
  return {
    id: r.id,
    venueId: r.venue_id,
    enrollmentId: r.enrollment_id,
    path: r.path,
    venueName: r.venue_name ?? "",
    addressLine1: r.address_line1,
    addressLine2: r.address_line2,
    city: r.city,
    stateRegion: r.state_region,
    postalCode: r.postal_code,
    country: r.country,
    primaryContactName: r.primary_contact_name,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    website: r.website,
    spaceMode: r.space_mode ?? "one",
    spaces: mapSpaces(r.spaces),
    offersTours: r.offers_tours ?? false,
    tastingAppointmentChoice: r.tasting_appointment_choice ?? "neither",
    inquirySources: (r.inquiry_sources ?? []) as InquirySourceKey[],
    inquirySourcesOther: r.inquiry_sources_other,
    bringBusinessChoice: r.bring_business_choice ?? "starting_fresh",
    acceptStarters: Boolean(r.starters_accepted_at),
    startersAcceptedAt: r.starters_accepted_at,
    submittedAt: r.submitted_at,
  };
}

export async function getIntakeForVenue(
  venueId: string,
): Promise<OnboardingIntakeRecord | null> {
  if (!isSupabaseConfigured) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("venue_onboarding_intake")
    .select("*")
    .eq("venue_id", venueId)
    .maybeSingle<IntakeRow>();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

/**
 * Save intake answers and apply safe configuration to the venue.
 * Does NOT set ready_to_invite_couples.
 */
export async function submitOnboardingIntake(input: {
  venueId: string;
  enrollmentId?: string | null;
  path: "self_setup" | "white_glove";
  intake: OnboardingIntakeInput;
}): Promise<{ ok: true; intakeId: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "not_configured" };
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const intake = input.intake;

  const spacesJson = (intake.spaces.length > 0
    ? intake.spaces
    : [{ name: "Main Space", maxCapacity: null }]
  ).map((s) => ({
    name: s.name.trim() || "Main Space",
    maxCapacity: s.maxCapacity,
  }));

  const row = {
    venue_id: input.venueId,
    enrollment_id: input.enrollmentId ?? null,
    path: input.path,
    venue_name: intake.venueName.trim(),
    address_line1: intake.addressLine1?.trim() || null,
    address_line2: intake.addressLine2?.trim() || null,
    city: intake.city?.trim() || null,
    state_region: intake.stateRegion?.trim() || null,
    postal_code: intake.postalCode?.trim() || null,
    country: intake.country?.trim() || null,
    primary_contact_name: intake.primaryContactName?.trim() || null,
    contact_email: intake.contactEmail?.trim().toLowerCase() || null,
    contact_phone: intake.contactPhone?.trim() || null,
    website: intake.website?.trim() || null,
    space_mode: intake.spaceMode,
    spaces: spacesJson,
    offers_tours: intake.offersTours,
    tasting_appointment_choice: intake.tastingAppointmentChoice,
    inquiry_sources: intake.inquirySources,
    inquiry_sources_other:
      intake.inquirySources.includes("other")
        ? intake.inquirySourcesOther?.trim() || null
        : null,
    bring_business_choice: intake.bringBusinessChoice,
    starters_accepted_at:
      intake.bringBusinessChoice === "starting_fresh" || intake.acceptStarters
        ? now
        : null,
    submitted_at: now,
  };

  const { data: saved, error } = await admin
    .from("venue_onboarding_intake")
    .upsert(row, { onConflict: "venue_id" })
    .select("id")
    .single<{ id: string }>();
  if (error) return { ok: false, error: error.message };

  // Apply venue basics
  await admin
    .from("venues")
    .update({
      name: intake.venueName.trim(),
      email: intake.contactEmail?.trim().toLowerCase() || undefined,
      phone: intake.contactPhone?.trim() || null,
      website: intake.website?.trim() || null,
      address_line1: intake.addressLine1?.trim() || null,
      address_line2: intake.addressLine2?.trim() || null,
      city: intake.city?.trim() || null,
      state_region: intake.stateRegion?.trim() || null,
      postal_code: intake.postalCode?.trim() || null,
      country: intake.country?.trim() || null,
    })
    .eq("id", input.venueId);

  // Spaces — create missing by name (idempotent)
  const { data: existingSpaces } = await admin
    .from("venue_spaces")
    .select("id, name")
    .eq("venue_id", input.venueId);
  const existingNames = new Set(
    (existingSpaces ?? []).map((s: { name: string }) => s.name.trim().toLowerCase()),
  );
  for (let i = 0; i < spacesJson.length; i++) {
    const space = spacesJson[i];
    const key = space.name.trim().toLowerCase();
    if (existingNames.has(key)) continue;
    await admin.from("venue_spaces").insert({
      venue_id: input.venueId,
      name: space.name,
      capacity: space.maxCapacity,
      sort_order: i,
      is_active: true,
    });
    existingNames.add(key);
  }

  // Tours — only enable when Yes; never invent extra tour rules
  if (intake.offersTours === false) {
    await admin
      .from("venues")
      .update({ tour_scheduling_enabled: false } as Record<string, unknown>)
      .eq("id", input.venueId);
  } else if (intake.offersTours === true) {
    await admin
      .from("venues")
      .update({ tour_scheduling_enabled: true } as Record<string, unknown>)
      .eq("id", input.venueId);
  }

  // Lead capture path from inquiry sources (safe default)
  const wantsAutomated = intake.inquirySources.some((s) =>
    ["website", "facebook_instagram", "marketplace"].includes(s),
  );
  const leadPath = wantsAutomated ? "automated" : "manual_external";
  await admin.from("venue_setup_hub_state").upsert(
    {
      venue_id: input.venueId,
      onboarding_type: input.path,
      lead_capture_path: leadPath,
      lead_capture_path_decided_at: now,
      bring_your_business_manual_confirmed_at:
        intake.bringBusinessChoice === "starting_fresh" ? now : null,
    },
    { onConflict: "venue_id" },
  );

  if (input.path === "white_glove" && input.enrollmentId) {
    await admin
      .from("venue_enrollments")
      .update({ white_glove_status: "waiting" })
      .eq("id", input.enrollmentId);
  }

  // Mark engagement in progress when intake lands for WG
  if (input.path === "white_glove") {
    await admin
      .from("venue_onboarding_engagements")
      .update({
        status: "in_progress",
        started_at: now,
        current_focus: "Review intake and materials",
      })
      .eq("venue_id", input.venueId)
      .eq("status", "not_started");
  }

  return { ok: true, intakeId: saved.id };
}
