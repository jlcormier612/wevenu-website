/**
 * Venue application service.
 *
 * Orchestrates the use cases that the UI and route gating depend on:
 * authentication, business-logic validation, and persistence via the
 * repository. Components and server actions call into here — never into the
 * repository or Supabase directly. Server-only.
 */
import { cache } from "react";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repository from "@/lib/venue/repository";
import type {
  Venue,
  VenueSetupErrors,
  VenueSetupInput,
} from "@/lib/venue/types";
import { validateStep, validateVenueSetup } from "@/lib/venue/validation";
import type {
  ProductVenueProfileFields,
  SyncVenueProfileReason,
} from "@shared/product-sync";

export type SubmitSetupResult =
  | { ok: true; venueId: string }
  | { ok: false; errors: VenueSetupErrors; message?: string };

/** Result type returned by each settings section save. */
export type SaveSectionResult =
  | { ok: true }
  | { ok: false; errors: VenueSetupErrors; message?: string };

function streetAddressFromSetup(input: VenueSetupInput): string {
  return [input.addressLine1.trim(), input.addressLine2.trim()]
    .filter(Boolean)
    .join(", ");
}

function profileFieldsFromSetup(input: VenueSetupInput): ProductVenueProfileFields {
  const capacityRaw = input.capacity.trim();
  const capacity = capacityRaw ? parseInt(capacityRaw, 10) : null;
  return {
    name: input.name,
    city: input.city,
    state: input.stateRegion,
    website: input.website,
    address: streetAddressFromSetup(input),
    venueType: input.venueType,
    capacity: Number.isFinite(capacity) ? capacity : null,
    ownerFullName: input.ownerFullName,
    ownerEmail: input.ownerEmail || input.email,
    ownerTitle: input.ownerTitle,
    // Product setup collects venue phone; use it as owner contact when present.
    ownerPhone: input.phone,
  };
}

/**
 * Soft product → CRM write-back. Never blocks setup/settings on CRM failure.
 */
function pushVenueProfileToCrm(
  venueId: string,
  input: VenueSetupInput,
  reason: SyncVenueProfileReason,
): void {
  void (async () => {
    try {
      const { syncVenueProfileFromProduct } = await import("@shared/product-sync");
      const result = await syncVenueProfileFromProduct({
        venueId,
        profile: profileFieldsFromSetup(input),
        reason,
      });
      if (!result.ok) {
        console.error("[product→crm] write-back error:", result.error);
      }
    } catch (error) {
      console.error("[product→crm] write-back failed:", error);
    }
  })();
}

/**
 * The current user's venue, or null if none exists / not authenticated /
 * Supabase not configured. Used by route gating and the workspace.
 *
 * Work Package R3 — wrapped in React's request-scoped `cache()`: Reporting
 * found this called a dozen-plus times on a single Overview page render
 * (every `lib/metrics/*` function resolves its own venue independently).
 * `cache()` dedupes identical calls within one render pass only — never
 * across requests/users, so this carries none of the cross-venue-leakage
 * risk a module-level cache would (the exact hazard this codebase has
 * already been burned by elsewhere). The venue cannot change mid-request,
 * so memoizing it for the request's lifetime is simply correct, not a
 * shortcut.
 */
export const getCurrentVenue = cache(async (): Promise<Venue | null> => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return repository.getVenueForCurrentUser(supabase);
});

/**
 * The current user's role on their venue ('owner' | 'manager' | 'coordinator'
 * | 'staff'), or null if none. Mirrors the `current_user_role()` SQL helper
 * (same source of truth used by RLS) — server actions call this for early,
 * good-error-message rejections; RLS is the backstop if this check is ever
 * bypassed or forgotten. See docs/trust-risk-register.md TR-G1.
 */
export async function getCurrentUserRole(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("current_user_role");
  return (data as string | null) ?? null;
}

/** True when the current user has a venue with setup completed. */
export async function hasCompletedVenueSetup(): Promise<boolean> {
  const venue = await getCurrentVenue();
  return Boolean(venue?.setupCompleted);
}

/**
 * Validate and persist the Venue Setup wizard. Validation runs here
 * authoritatively (regardless of any client-side checks) before writing.
 */
export async function submitVenueSetup(
  input: VenueSetupInput,
): Promise<SubmitSetupResult> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      errors: {},
      message: "The data backend is not configured in this environment.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      errors: {},
      message: "Your session has expired. Please sign in again.",
    };
  }

  const errors = validateVenueSetup(input);
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  // WP4 — finalize only after Legal Acceptance Engine is satisfied (Welcome Experience).
  try {
    const { legalAcceptanceService } = await import("@/lib/legal/acceptance-engine");
    const legal = await legalAcceptanceService.requiresAcceptance({
      userId: user.id,
      userType: "venue_owner",
    });
    if (legal.requiresAcceptance) {
      return {
        ok: false,
        errors: {},
        message:
          "Please review and accept the required documents before creating your venue workspace.",
      };
    }
  } catch (legalError) {
    console.error("[setup] legal acceptance check failed", legalError);
    return {
      ok: false,
      errors: {},
      message:
        "We couldn't verify legal acceptance. Please try again from the Welcome screen.",
    };
  }

  // Idempotency: if a completed venue already exists, treat as success.
  const existing = await repository.getVenueForCurrentUser(supabase);
  if (existing?.setupCompleted) {
    pushVenueProfileToCrm(existing.id, input, "setup_submit");
    return { ok: true, venueId: existing.id };
  }

  try {
    const venueId = await repository.insertVenueSetup(supabase, input);
    try {
      const { seedStarterInventory } = await import("@/lib/inventory/service");
      await seedStarterInventory(venueId);
    } catch (seedError) {
      // Non-fatal — a new venue without a seeded starter catalog can still
      // add Inventory by hand; it should never block venue creation itself.
      console.error("Could not seed starter inventory:", seedError);
    }
    try {
      const { seedStarterMessageTemplates } = await import("@/lib/message-templates/provision");
      await seedStarterMessageTemplates(venueId);
    } catch (seedError) {
      console.error("Could not seed starter message templates:", seedError);
    }
    try {
      const { seedStarterAutomations } = await import("@/lib/message-sequences/provision");
      await seedStarterAutomations(venueId);
    } catch (seedError) {
      console.error("Could not seed starter automations:", seedError);
    }
    try {
      const { seedContractStarters } = await import("@/lib/contracts/provision");
      await seedContractStarters(venueId);
    } catch (seedError) {
      console.error("Could not seed contract starters:", seedError);
    }
    try {
      const { seedQuestionnaireFamily } = await import("@/lib/questionnaire-family/provision");
      await seedQuestionnaireFamily(venueId);
    } catch (seedError) {
      console.error("Could not seed questionnaire family:", seedError);
    }
    try {
      const { seedEventOrderStarters } = await import("@/lib/event-order-templates/provision");
      await seedEventOrderStarters(venueId);
    } catch (seedError) {
      console.error("Could not seed event order starters:", seedError);
    }
    try {
      const { seedTimelineStarters } = await import("@/lib/timeline-templates/provision");
      await seedTimelineStarters(venueId);
    } catch (seedError) {
      console.error("Could not seed timeline starters:", seedError);
    }
    try {
      const { seedFloorPlanStarters } = await import("@/lib/floor-plan-templates/provision");
      await seedFloorPlanStarters(venueId);
    } catch (seedError) {
      console.error("Could not seed floor plan starters:", seedError);
    }
    try {
      const { seedPackageStarters } = await import("@/lib/packages/provision");
      await seedPackageStarters(venueId);
    } catch (seedError) {
      console.error("Could not seed package starters:", seedError);
    }
    try {
      const { seedFaqStarters } = await import("@/lib/venue-guide/provision");
      await seedFaqStarters(venueId);
    } catch (seedError) {
      console.error("Could not seed FAQ starters:", seedError);
    }
    try {
      const { seedBrochureStarters } = await import("@/lib/brochures/provision");
      await seedBrochureStarters(venueId);
    } catch (seedError) {
      console.error("Could not seed brochure starters:", seedError);
    }
    try {
      const { seedSavedReportStarters } = await import("@/lib/saved-reports/provision");
      await seedSavedReportStarters(venueId);
    } catch (seedError) {
      console.error("Could not seed saved report starters:", seedError);
    }
    pushVenueProfileToCrm(venueId, input, "setup_submit");
    return { ok: true, venueId };
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "23505") {
      // Unique violation — a venue already exists for this owner.
      const venue = await repository.getVenueForCurrentUser(supabase);
      if (venue) {
        pushVenueProfileToCrm(venue.id, input, "setup_submit");
        return { ok: true, venueId: venue.id };
      }
    }
    const message =
      error instanceof Error
        ? error.message
        : "We couldn't save your venue. Please try again.";
    return { ok: false, errors: {}, message };
  }
}

/**
 * Guided Setup — save progress mid-wizard, before the venue exists as a
 * finished thing. Deliberately unvalidated (unlike submitVenueSetup): a
 * partial, in-progress save is not held to "is this a complete venue"
 * standards — whatever's filled in so far is written as-is, with
 * setup_completed:false, so a venue that's abandoned mid-flow and returned
 * to later resumes exactly where it left off instead of starting over.
 * Fire-and-forget from the wizard's perspective; never blocks navigation.
 */
export async function saveSetupProgress(
  input: VenueSetupInput,
  lastStep: string,
): Promise<{ ok: boolean; venueId?: string }> {
  if (!isSupabaseConfigured) return { ok: false };
  if (!input.name.trim()) return { ok: false }; // nothing to anchor a row to yet

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  try {
    const venueId = await repository.insertVenueSetup(supabase, input, false, lastStep);
    pushVenueProfileToCrm(venueId, input, "setup_progress");
    return { ok: true, venueId };
  } catch (error) {
    console.error("Could not save setup progress:", error);
    return { ok: false };
  }
}

// ---- Settings ---------------------------------------------------------------

/**
 * Shared auth + venue guard for all settings saves. Calls `fn` only if the
 * current user is authenticated and has a venue.
 */
async function withVenue(
  fn: (
    supabase: Awaited<ReturnType<typeof createClient>>,
    venueId: string,
  ) => Promise<SaveSectionResult>,
): Promise<SaveSectionResult> {
  if (!isSupabaseConfigured)
    return { ok: false, errors: {}, message: "Backend not configured." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { ok: false, errors: {}, message: "Session expired. Please sign in again." };
  const venue = await repository.getVenueForCurrentUser(supabase);
  if (!venue)
    return { ok: false, errors: {}, message: "Venue not found." };
  return fn(supabase, venue.id);
}

function normalizeUrl(value: string): string {
  const v = value.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/**
 * Load the venue plus its hours and owner staff record, mapped to
 * VenueSetupInput so the settings form can reuse the wizard step components.
 */
export async function getVenueSettings(): Promise<{
  input: VenueSetupInput;
  venueId: string;
  setupLastStep: string | null;
} | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const details = await repository.getVenueFullDetails(supabase);
  if (!details) return null;
  const { venue, hours, ownerName, ownerTitle, ownerEmail } = details;
  const input: VenueSetupInput = {
    onboardingPersona: venue.onboardingPersona,
    name: venue.name,
    businessName: venue.businessName ?? "",
    email: venue.email ?? "",
    phone: venue.phone ?? "",
    website: venue.website ?? "",
    addressLine1: venue.addressLine1 ?? "",
    addressLine2: venue.addressLine2 ?? "",
    city: venue.city ?? "",
    stateRegion: venue.stateRegion ?? "",
    postalCode: venue.postalCode ?? "",
    country: venue.country ?? "",
    venueType: venue.venueType ?? "",
    capacity: venue.capacity != null ? String(venue.capacity) : "",
    timezone: venue.timezone,
    businessHours: hours,
    logoUrl: venue.logoUrl ?? "",
    heroImageUrl: venue.heroImageUrl ?? "",
    story: venue.story ?? "",
    primaryColor: venue.primaryColor,
    secondaryColor: venue.secondaryColor,
    accentColor: venue.accentColor ?? "#B8AEA1",
    neutralColor: venue.neutralColor ?? "#F7F5F1",
    ownerFullName: ownerName,
    ownerEmail: ownerEmail || venue.email || "",
    ownerTitle: ownerTitle || "Owner",
    currency: venue.currency,
    weekStartsOn: venue.weekStartsOn,
    stripeOnboardingStatus: venue.stripeOnboardingStatus,
  };
  return { input, venueId: venue.id, setupLastStep: venue.setupLastStep };
}

/** Save: venue name, business name, contact details, and address. */
export async function saveVenueInfoSection(
  input: VenueSetupInput,
): Promise<SaveSectionResult> {
  const errors = validateStep("venue-info", input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return withVenue(async (supabase, venueId) => {
    await repository.updateVenueFields(supabase, venueId, {
      name: input.name.trim(),
      business_name: input.businessName.trim() || null,
      email: input.email.trim() || null,
      phone: input.phone.trim() || null,
      website: normalizeUrl(input.website) || null,
      address_line1: input.addressLine1.trim() || null,
      address_line2: input.addressLine2.trim() || null,
      city: input.city.trim() || null,
      state_region: input.stateRegion.trim() || null,
      postal_code: input.postalCode.trim() || null,
      country: input.country.trim() || null,
    });
    pushVenueProfileToCrm(venueId, input, "settings");
    return { ok: true };
  });
}

/** Save: venue type, capacity, time zone. */
export async function saveVenueProfileSection(
  input: VenueSetupInput,
): Promise<SaveSectionResult> {
  const errors = validateStep("venue-details", input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return withVenue(async (supabase, venueId) => {
    await repository.updateVenueFields(supabase, venueId, {
      venue_type: input.venueType || null,
      capacity: input.capacity.trim() ? parseInt(input.capacity, 10) : null,
      timezone: input.timezone,
    });
    pushVenueProfileToCrm(venueId, input, "settings");
    return { ok: true };
  });
}

/** Save: all seven business-hours rows via upsert. */
export async function saveBusinessHoursSection(
  input: VenueSetupInput,
): Promise<SaveSectionResult> {
  const errors = validateStep("business-hours", input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return withVenue(async (supabase, venueId) => {
    await repository.upsertBusinessHours(supabase, venueId, input.businessHours);
    return { ok: true };
  });
}

/** Save: public review destination for Post-Event Feedback. */
export async function updatePublicReviewUrl(
  url: string | null,
): Promise<{ ok: boolean; message?: string }> {
  return withVenue(async (supabase, venueId) => {
    const trimmed = (url ?? "").trim();
    const normalized = trimmed
      ? (/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
      : null;
    await repository.updateVenueFields(supabase, venueId, {
      public_review_url: normalized,
    });
    return { ok: true };
  });
}

/** Save: logo URL and brand colors. */
export async function saveBrandSection(
  input: VenueSetupInput,
): Promise<SaveSectionResult> {
  const errors = validateStep("brand", input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return withVenue(async (supabase, venueId) => {
    await repository.updateVenueFields(supabase, venueId, {
      logo_url: input.logoUrl.trim() || null,
      primary_color: input.primaryColor,
      secondary_color: input.secondaryColor,
      accent_color: input.accentColor,
      neutral_color: input.neutralColor,
    });
    return { ok: true };
  });
}

/** Save: owner name/title/email and general settings (currency, week start). */
export async function saveOwnerSection(
  input: VenueSetupInput,
): Promise<SaveSectionResult> {
  const errors = validateStep("owner", input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return withVenue(async (supabase, venueId) => {
    await Promise.all([
      repository.updateOwnerStaff(supabase, venueId, {
        full_name: input.ownerFullName.trim(),
        title: input.ownerTitle.trim() || null,
        email: input.ownerEmail.trim() || null,
      }),
      repository.updateVenueFields(supabase, venueId, {
        currency: input.currency,
        week_starts_on: input.weekStartsOn,
      }),
    ]);
    pushVenueProfileToCrm(venueId, input, "settings");
    return { ok: true };
  });
}

/** Permanently hides the Getting Started card for this venue. */
export async function dismissOnboarding(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = await createClient();
  const venue = await getCurrentVenue();
  if (!venue) return;
  await repository.updateVenueFields(supabase, venue.id, {
    onboarding_dismissed: true,
  });
}

/** Luv Experience Completion, Work Stream 5 — one-time intro, never shown again. */
export async function markLuvIntroSeen(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = await createClient();
  const venue = await getCurrentVenue();
  if (!venue) return;
  await repository.updateVenueFields(supabase, venue.id, {
    luv_intro_seen_at: new Date().toISOString(),
  });
}

/** Update the venue logo URL (or clear it when url is null). */
export async function updateVenueLogo(url: string | null): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = await createClient();
  const venue = await getCurrentVenue();
  if (!venue) return;
  await repository.updateVenueFields(supabase, venue.id, { logo_url: url ?? null });
}

/**
 * Program 4, Initiative D (2026-07-23) — the same photo backs both the
 * Couple Workspace hero and the Venue Guide, so it's one upload here, not
 * two.
 */
export async function updateVenueHeroImage(url: string | null): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = await createClient();
  const venue = await getCurrentVenue();
  if (!venue) return;
  await repository.updateVenueFields(supabase, venue.id, { hero_image_url: url ?? null });
}

export async function updateVenueStory(story: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = await createClient();
  const venue = await getCurrentVenue();
  if (!venue) return;
  await repository.updateVenueFields(supabase, venue.id, { story: story.trim() || null });
}

// connectStripeAccount()/disconnectStripeAccount() moved to
// lib/stripe/service.ts (Sprint 4 — Venue Payment Processing), which reads
// Stripe's real charges_enabled flag and calls Stripe's own deauthorize
// endpoint, instead of the placeholder local-only versions that lived here.

export type SetupReadyCounts = {
  packages: number;
  inventory: number;
  contractTemplates: number;
  communicationTemplates: number;
  playbookTemplates: number;
  vendorRelationships: number;
  contacts: number;
  upcomingEvents: number;
};

const EMPTY_SETUP_READY_COUNTS: SetupReadyCounts = {
  packages: 0, inventory: 0, contractTemplates: 0, communicationTemplates: 0,
  playbookTemplates: 0, vendorRelationships: 0, contacts: 0, upcomingEvents: 0,
};

/**
 * Guided Setup — real counts only, queried live against the venue's own
 * RLS-scoped session. Never a fabricated or cached number: called when a
 * stage renders, straight off the same tables every other part of the
 * product reads. Feeds both the per-stage "you already have N of these"
 * checks (Offerings/Business Tools/People) and the "Ready to Go" summary.
 * A count of 0 for a domain is simply omitted by the caller, never shown as
 * a false "0 packages ready."
 */
export async function getSetupReadyCounts(venueId: string): Promise<SetupReadyCounts> {
  if (!isSupabaseConfigured) return EMPTY_SETUP_READY_COUNTS;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    packages, inventory, contractTemplates, communicationTemplates, playbookTemplates,
    vendorRelationships, clients, leads, upcomingEvents,
  ] = await Promise.all([
    supabase.from("packages").select("id", { count: "exact", head: true })
      .eq("venue_id", venueId).eq("is_active", true),
    supabase.from("inventory_items").select("id", { count: "exact", head: true })
      .eq("venue_id", venueId).eq("is_archived", false),
    supabase.from("contract_templates").select("id", { count: "exact", head: true })
      .eq("venue_id", venueId).eq("is_archived", false),
    supabase.from("message_templates").select("id", { count: "exact", head: true })
      .eq("venue_id", venueId).eq("is_archived", false),
    supabase.from("playbook_templates").select("id", { count: "exact", head: true })
      .eq("venue_id", venueId).eq("is_archived", false),
    supabase.from("venue_vendor_relationships").select("id", { count: "exact", head: true })
      .eq("venue_id", venueId).eq("status", "active"),
    supabase.from("clients").select("id", { count: "exact", head: true })
      .eq("venue_id", venueId).neq("status", "cancelled"),
    supabase.from("leads").select("id", { count: "exact", head: true })
      .eq("venue_id", venueId).not("status", "in", "(won,lost,cancelled)"),
    supabase.from("events").select("id", { count: "exact", head: true })
      .eq("venue_id", venueId).neq("status", "cancelled").gte("event_date", today),
  ]);

  return {
    packages: packages.count ?? 0,
    inventory: inventory.count ?? 0,
    contractTemplates: contractTemplates.count ?? 0,
    communicationTemplates: communicationTemplates.count ?? 0,
    playbookTemplates: playbookTemplates.count ?? 0,
    vendorRelationships: vendorRelationships.count ?? 0,
    contacts: (clients.count ?? 0) + (leads.count ?? 0),
    upcomingEvents: upcomingEvents.count ?? 0,
  };
}
