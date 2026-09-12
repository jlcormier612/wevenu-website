/**
 * White Glove handoff — Finish White Glove Setup.
 * Validates, mints activation token, sends access email once.
 */
import { randomBytes } from "crypto";

import { activationUrlFromToken, sendWelcomeHomeEmail } from "@shared/email";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { requireAdminUser } from "@/lib/hq/crm-service";

export type HandoffValidationIssue = {
  code: string;
  message: string;
};

export type FinishWhiteGloveResult =
  | { ok: true; alreadyHandedOff: boolean; activateUrl: string }
  | { ok: false; issues: HandoffValidationIssue[]; error?: string };

function newActivationToken(): string {
  return `act_${randomBytes(24).toString("hex")}`;
}

export async function validateWhiteGloveHandoff(
  venueId: string,
): Promise<{ ok: true } | { ok: false; issues: HandoffValidationIssue[] }> {
  const admin = createAdminClient();
  const issues: HandoffValidationIssue[] = [];

  const { data: venue } = await admin
    .from("venues")
    .select("id, name, owner_user_id")
    .eq("id", venueId)
    .maybeSingle();
  if (!venue) {
    issues.push({ code: "venue_missing", message: "Venue does not exist." });
    return { ok: false, issues };
  }

  const { data: staff } = await admin
    .from("venue_staff")
    .select("id, user_id, email")
    .eq("venue_id", venueId)
    .eq("is_owner", true)
    .maybeSingle();
  if (!staff) {
    issues.push({
      code: "owner_membership_missing",
      message: "Owner relationship/membership is missing.",
    });
  }

  const { data: enrollment } = await admin
    .from("venue_enrollments")
    .select("id, owner_email, onboarding_type, status, white_glove_status, venue_id")
    .eq("venue_id", venueId)
    .eq("onboarding_type", "white_glove")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!enrollment) {
    issues.push({
      code: "enrollment_missing",
      message: "Owner enrollment/account information is missing.",
    });
  } else if (!enrollment.owner_email?.includes("@")) {
    issues.push({
      code: "owner_email_missing",
      message: "Owner email is missing on the enrollment.",
    });
  }

  if (
    enrollment &&
    enrollment.white_glove_status === "setup_complete_access_pending" &&
    enrollment.status !== "activated"
  ) {
    // Valid for retry of email send — not a blocker
  } else if (enrollment && enrollment.status === "activated") {
    issues.push({
      code: "already_activated",
      message: "Customer has already activated access.",
    });
  }

  const { data: hub } = await admin
    .from("venue_setup_hub_state")
    .select("venue_id")
    .eq("venue_id", venueId)
    .maybeSingle();
  if (!hub) {
    issues.push({
      code: "setup_hub_missing",
      message: "Setup Hub state is missing.",
    });
  }

  if (!venue.owner_user_id) {
    issues.push({
      code: "auth_user_missing",
      message: "Required authentication/activation information is missing.",
    });
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Staff action: Finish White Glove Setup → Customer Access Pending → email.
 */
export async function finishWhiteGloveSetup(
  venueId: string,
  opts?: { relationshipId?: string | null; firstName?: string | null },
): Promise<FinishWhiteGloveResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, issues: [], error: "not_configured" };
  }

  const actor = await requireAdminUser();
  if (!actor) {
    return { ok: false, issues: [], error: "unauthorized" };
  }

  const validation = await validateWhiteGloveHandoff(venueId);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues };
  }

  const admin = createAdminClient();
  const { data: enrollment } = await admin
    .from("venue_enrollments")
    .select(
      "id, owner_email, venue_name, status, white_glove_status, activation_token, access_email_sent_at",
    )
    .eq("venue_id", venueId)
    .eq("onboarding_type", "white_glove")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      owner_email: string;
      venue_name: string;
      status: string;
      white_glove_status: string | null;
      activation_token: string | null;
      access_email_sent_at: string | null;
    }>();

  if (!enrollment) {
    return {
      ok: false,
      issues: [{ code: "enrollment_missing", message: "Enrollment missing." }],
    };
  }

  const alreadyHandedOff =
    enrollment.white_glove_status === "setup_complete_access_pending" ||
    Boolean(enrollment.access_email_sent_at);

  let token = enrollment.activation_token;
  if (!token) {
    token = newActivationToken();
  }

  const { error: updErr } = await admin
    .from("venue_enrollments")
    .update({
      activation_token: token,
      activation_token_created_at: new Date().toISOString(),
      white_glove_status: "setup_complete_access_pending",
      white_glove_handoff_at: new Date().toISOString(),
      white_glove_handoff_by: actor.userId,
    })
    .eq("id", enrollment.id);

  if (updErr) {
    return { ok: false, issues: [], error: updErr.message };
  }

  await admin
    .from("venue_onboarding_engagements")
    .update({
      status: "complete",
      completed_at: new Date().toISOString(),
      current_focus: "Handed off to customer",
    })
    .eq("venue_id", venueId);

  const activateUrl = activationUrlFromToken(token);

  // Idempotent email: skip if already sent for this handoff.
  if (!enrollment.access_email_sent_at) {
    const relationshipId = opts?.relationshipId?.trim() || `venue:${venueId}`;
    const emailResult = await sendWelcomeHomeEmail({
      relationshipId,
      customerEmail: enrollment.owner_email,
      venueName: enrollment.venue_name,
      firstName: opts?.firstName ?? null,
      activateUrl,
    });

    if (!emailResult?.ok) {
      console.error("[white-glove/handoff] access email failed", emailResult);
      try {
        await admin.from("venue_hq_tasks").insert({
          venue_id: venueId,
          title: "White Glove handoff: access email failed — retry Finish White Glove Setup",
          kind: "blocker",
          assigned_id: actor.userId,
          assigned_name: actor.name,
        });
      } catch {
        /* alert best-effort */
      }
      return {
        ok: false,
        issues: [
          {
            code: "access_email_failed",
            message:
              "Handoff state saved, but the access email failed to send. Retry Finish White Glove Setup.",
          },
        ],
      };
    }

    await admin
      .from("venue_enrollments")
      .update({ access_email_sent_at: new Date().toISOString() })
      .eq("id", enrollment.id);
  }

  // Thin product → CRM sync: handoff complete (idempotent).
  try {
    const { recordCrmWhiteGloveHandoffComplete } = await import("@shared/relationships");
    await recordCrmWhiteGloveHandoffComplete({
      productVenueId: venueId,
      ownerEmail: enrollment.owner_email,
    });
  } catch (crmErr) {
    console.error("[white-glove/handoff] CRM milestone sync failed", crmErr);
  }

  return { ok: true, alreadyHandedOff, activateUrl };
}
