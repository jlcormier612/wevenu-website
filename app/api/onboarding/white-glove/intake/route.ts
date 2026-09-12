import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { submitOnboardingIntake } from "@/lib/onboarding/intake-service";
import type { OnboardingIntakeInput } from "@/lib/onboarding/types";

export const runtime = "nodejs";

/**
 * Token-scoped White Glove intake submit (no venue session required).
 * Body: { intakeToken, intake }
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let body: { intakeToken?: string; intake?: OnboardingIntakeInput };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const token = body.intakeToken?.trim();
  if (!token || !body.intake) {
    return NextResponse.json({ error: "intakeToken and intake are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: enrollment, error } = await admin
    .from("venue_enrollments")
    .select("id, venue_id, owner_email, onboarding_type, white_glove_status, status")
    .eq("intake_token", token)
    .maybeSingle<{
      id: string;
      venue_id: string | null;
      owner_email: string | null;
      onboarding_type: string;
      white_glove_status: string | null;
      status: string;
    }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!enrollment || enrollment.onboarding_type !== "white_glove" || !enrollment.venue_id) {
    return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  }
  if (enrollment.status === "activated") {
    return NextResponse.json({ error: "already_activated" }, { status: 409 });
  }

  const result = await submitOnboardingIntake({
    venueId: enrollment.venue_id,
    enrollmentId: enrollment.id,
    path: "white_glove",
    intake: body.intake,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  try {
    const { recordCrmWhiteGloveIntakeSubmitted } = await import("@shared/relationships");
    await recordCrmWhiteGloveIntakeSubmitted({
      productVenueId: enrollment.venue_id,
      ownerEmail: enrollment.owner_email,
    });
  } catch (crmErr) {
    console.error("[white-glove/intake] CRM milestone sync failed", crmErr);
  }

  return NextResponse.json({ ok: true, waiting: true });
}
