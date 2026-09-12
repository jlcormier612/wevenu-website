/**
 * Reusable workspace provisioning — independent of the legacy SetupWizard.
 *
 * Creates/links the minimum viable prepared workspace:
 * - venue row (when needed)
 * - owner venue_staff
 * - Setup Hub state
 * - White Glove engagement (when onboarding_type = white_glove)
 * - starter content
 *
 * Idempotent: retries must not duplicate venue, staff, hub state, engagement,
 * or starter content.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveUserIdForEmail } from "@/lib/legal/service";
import { seedWorkspaceStarters, type StarterSeedResult } from "@/lib/provisioning/starters";
import type { OnboardingType } from "@/lib/setup-hub/types";
import { randomBytes } from "crypto";

export type ProvisionWorkspaceInput = {
  enrollmentId: string;
  /** When set, skips auth user lookup/create. */
  ownerUserId?: string;
};

export type ProvisionWorkspaceResult =
  | {
      ok: true;
      venueId: string;
      alreadyProvisioned: boolean;
      intakeToken: string | null;
      starters: StarterSeedResult;
    }
  | { ok: false; error: string };

type EnrollmentRow = {
  id: string;
  venue_name: string;
  owner_email: string;
  owner_first_name: string | null;
  owner_last_name: string | null;
  onboarding_type: OnboardingType;
  status: string;
  venue_id: string | null;
  intake_token: string | null;
  white_glove_status: string | null;
};

function newIntakeToken(): string {
  return `intake_${randomBytes(24).toString("hex")}`;
}

function ownerDisplayName(row: EnrollmentRow): string {
  const parts = [row.owner_first_name, row.owner_last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return row.venue_name?.trim() || "Owner";
}

/**
 * Provision a venue workspace from a durable enrollment row.
 * Used for White Glove immediately after purchase, and for Self-Setup
 * when activation creates/links the venue.
 */
export async function provisionWorkspaceFromEnrollment(
  input: ProvisionWorkspaceInput,
): Promise<ProvisionWorkspaceResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const admin = createAdminClient();

  const { data: enrollment, error: enrollErr } = await admin
    .from("venue_enrollments")
    .select(
      "id, venue_name, owner_email, owner_first_name, owner_last_name, onboarding_type, status, venue_id, intake_token, white_glove_status",
    )
    .eq("id", input.enrollmentId)
    .maybeSingle<EnrollmentRow>();

  if (enrollErr) {
    return { ok: false, error: enrollErr.message };
  }
  if (!enrollment) {
    return { ok: false, error: "enrollment_not_found" };
  }

  const ownerUserId =
    input.ownerUserId ?? (await resolveUserIdForEmail(enrollment.owner_email));

  let venueId = enrollment.venue_id;
  let alreadyProvisioned = Boolean(venueId);
  let intakeToken = enrollment.intake_token;

  if (!venueId) {
    const { data: existingVenue } = await admin
      .from("venues")
      .select("id")
      .eq("owner_user_id", ownerUserId)
      .maybeSingle<{ id: string }>();

    if (existingVenue?.id) {
      venueId = existingVenue.id;
      alreadyProvisioned = true;
    } else {
      const { data: created, error: venueErr } = await admin
        .from("venues")
        .insert({
          owner_user_id: ownerUserId,
          name: enrollment.venue_name,
          email: enrollment.owner_email,
          setup_completed: false,
        })
        .select("id")
        .single<{ id: string }>();

      if (venueErr) {
        // Concurrent provision — unique owner — re-read.
        if (venueErr.code === "23505") {
          const { data: raced } = await admin
            .from("venues")
            .select("id")
            .eq("owner_user_id", ownerUserId)
            .maybeSingle<{ id: string }>();
          if (!raced?.id) {
            return { ok: false, error: venueErr.message };
          }
          venueId = raced.id;
          alreadyProvisioned = true;
        } else {
          return { ok: false, error: venueErr.message };
        }
      } else {
        venueId = created.id;
        alreadyProvisioned = false;
      }
    }
  }

  // Owner staff — idempotent upsert on unique owner-per-venue.
  const { error: staffErr } = await admin.from("venue_staff").upsert(
    {
      venue_id: venueId,
      user_id: ownerUserId,
      full_name: ownerDisplayName(enrollment),
      email: enrollment.owner_email,
      role: "owner",
      is_owner: true,
      accepted_at: new Date().toISOString(),
      is_active: true,
    },
    { onConflict: "venue_id", ignoreDuplicates: false },
  );
  // Partial unique index on (venue_id) WHERE is_owner — PostgREST upsert
  // may not support the partial constraint; fall back to insert-or-update.
  if (staffErr) {
    const { data: existingStaff } = await admin
      .from("venue_staff")
      .select("id")
      .eq("venue_id", venueId)
      .eq("is_owner", true)
      .maybeSingle<{ id: string }>();
    if (existingStaff?.id) {
      await admin
        .from("venue_staff")
        .update({
          user_id: ownerUserId,
          email: enrollment.owner_email,
          full_name: ownerDisplayName(enrollment),
          is_active: true,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", existingStaff.id);
    } else {
      const { error: insertStaffErr } = await admin.from("venue_staff").insert({
        venue_id: venueId,
        user_id: ownerUserId,
        full_name: ownerDisplayName(enrollment),
        email: enrollment.owner_email,
        role: "owner",
        is_owner: true,
        accepted_at: new Date().toISOString(),
        is_active: true,
      });
      if (insertStaffErr && insertStaffErr.code !== "23505") {
        return { ok: false, error: insertStaffErr.message };
      }
    }
  }

  // Setup Hub state
  const { error: hubErr } = await admin.from("venue_setup_hub_state").upsert(
    {
      venue_id: venueId,
      onboarding_type: enrollment.onboarding_type,
    },
    { onConflict: "venue_id", ignoreDuplicates: true },
  );
  if (hubErr && hubErr.code !== "23505") {
    console.error("[provisioning] setup hub state", hubErr);
  }

  // White Glove engagement + intake token
  if (enrollment.onboarding_type === "white_glove") {
    const { error: engErr } = await admin.from("venue_onboarding_engagements").upsert(
      {
        venue_id: venueId,
        status: "not_started",
      },
      { onConflict: "venue_id", ignoreDuplicates: true },
    );
    if (engErr && engErr.code !== "23505") {
      console.error("[provisioning] white glove engagement", engErr);
    }
    if (!intakeToken) {
      intakeToken = newIntakeToken();
    }
  }

  // Enrollment linkage — do not mark activated (customer access) here.
  const enrollPatch: Record<string, unknown> = {
    venue_id: venueId,
  };
  if (enrollment.status === "pending" || enrollment.status === "provisioned") {
    enrollPatch.status = "provisioned";
  }
  if (enrollment.onboarding_type === "white_glove") {
    enrollPatch.intake_token = intakeToken;
    if (
      !enrollment.white_glove_status ||
      enrollment.white_glove_status === "awaiting_provision"
    ) {
      enrollPatch.white_glove_status = "awaiting_intake";
    }
  }

  const { error: linkErr } = await admin
    .from("venue_enrollments")
    .update(enrollPatch)
    .eq("id", enrollment.id);
  if (linkErr) {
    return { ok: false, error: linkErr.message };
  }

  const starters = await seedWorkspaceStarters(venueId, admin);

  return {
    ok: true,
    venueId,
    alreadyProvisioned,
    intakeToken: intakeToken ?? null,
    starters,
  };
}

/**
 * Ensure starters + hub state for an already-created venue (e.g. after
 * activate_venue_enrollment RPC creates the venue row).
 */
export async function ensureProvisionedWorkspace(input: {
  venueId: string;
  onboardingType: OnboardingType;
  enrollmentId?: string;
}): Promise<{ ok: true; starters: StarterSeedResult } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const admin = createAdminClient();

  await admin.from("venue_setup_hub_state").upsert(
    {
      venue_id: input.venueId,
      onboarding_type: input.onboardingType,
    },
    { onConflict: "venue_id", ignoreDuplicates: true },
  );

  if (input.onboardingType === "white_glove") {
    await admin.from("venue_onboarding_engagements").upsert(
      {
        venue_id: input.venueId,
        status: "not_started",
      },
      { onConflict: "venue_id", ignoreDuplicates: true },
    );
  }

  if (input.enrollmentId) {
    const { data: enroll } = await admin
      .from("venue_enrollments")
      .select("status")
      .eq("id", input.enrollmentId)
      .maybeSingle<{ status: string }>();
    if (enroll && enroll.status !== "activated") {
      await admin
        .from("venue_enrollments")
        .update({
          venue_id: input.venueId,
          status: "provisioned",
        })
        .eq("id", input.enrollmentId);
    } else if (enroll?.status === "activated") {
      await admin
        .from("venue_enrollments")
        .update({ venue_id: input.venueId })
        .eq("id", input.enrollmentId)
        .is("venue_id", null);
    }
  }

  const starters = await seedWorkspaceStarters(input.venueId, admin);
  return { ok: true, starters };
}
