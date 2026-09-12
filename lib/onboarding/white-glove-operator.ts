/**
 * Build operator-facing Setup Hub stage statuses for White Glove.
 * Labels: We can finish this / Your decision needed / Can be completed later / In progress.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { getIntakeForVenue } from "@/lib/onboarding/intake-service";
import { validateWhiteGloveHandoff } from "@/lib/onboarding/white-glove-handoff";
import type { OperatorStageRow } from "@/components/hq/white-glove-operator-panel";

export async function getWhiteGloveOperatorView(venueId: string) {
  const admin = createAdminClient();

  const [
    intake,
    materialsRes,
    hubRes,
    enrollmentRes,
    spacesRes,
    migrationRes,
    validation,
  ] = await Promise.all([
    getIntakeForVenue(venueId),
    admin
      .from("venue_onboarding_materials")
      .select("id, file_name, public_url")
      .eq("venue_id", venueId)
      .order("uploaded_at", { ascending: false }),
    admin.from("venue_setup_hub_state").select("*").eq("venue_id", venueId).maybeSingle(),
    admin
      .from("venue_enrollments")
      .select("white_glove_status, venue_name, owner_email, access_email_sent_at")
      .eq("venue_id", venueId)
      .eq("onboarding_type", "white_glove")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("venue_spaces").select("id").eq("venue_id", venueId),
    admin
      .from("migration_sessions")
      .select("id, status")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    validateWhiteGloveHandoff(venueId),
  ]);

  const hub = hubRes.data;
  const spacesCount = spacesRes.data?.length ?? 0;
  const migration = migrationRes.data;

  const stages: OperatorStageRow[] = [
    {
      key: "venue",
      title: "Venue information",
      status: intake?.submittedAt || hub?.your_venue_reviewed_at ? "complete" : "we_can_finish",
      detail: intake?.venueName ? `Intake: ${intake.venueName}` : null,
    },
    {
      key: "calendar",
      title: "Calendar model",
      status:
        intake?.offersTours === false && intake?.tastingAppointmentChoice === "neither"
          ? "we_can_finish"
          : "decision_needed",
      detail:
        spacesCount > 0
          ? `${spacesCount} space(s) configured`
          : "Spaces/capacity still needed when applicable",
    },
    {
      key: "branding",
      title: "Branding",
      status: "can_complete_later",
    },
    {
      key: "migration",
      title: "Business migration",
      status: migration
        ? migration.status === "committed" || migration.status === "complete"
          ? "complete"
          : "in_progress"
        : intake?.bringBusinessChoice === "starting_fresh"
          ? "complete"
          : intake?.bringBusinessChoice
            ? "in_progress"
            : "we_can_finish",
      detail: intake?.bringBusinessChoice
        ? `Customer chose: ${intake.bringBusinessChoice}`
        : null,
    },
    {
      key: "offerings",
      title: "Offerings",
      status: hub?.your_offerings_reviewed_at ? "complete" : "we_can_finish",
    },
    {
      key: "client_experience",
      title: "Client experience",
      status: hub?.client_experience_reviewed_at ? "complete" : "we_can_finish",
    },
    {
      key: "lead_capture",
      title: "Lead capture",
      status: hub?.lead_capture_path_decided_at ? "complete" : "we_can_finish",
    },
    {
      key: "financials",
      title: "Financial connections",
      status: "decision_needed",
      detail: "Stripe/QuickBooks require the owner's explicit action",
    },
  ];

  const intakeSummary = intake
    ? [
        `Contact: ${intake.primaryContactName ?? "—"} · ${intake.contactEmail ?? "—"} · ${intake.contactPhone ?? "—"}`,
        `Spaces: ${intake.spaceMode} · Tours: ${intake.offersTours ? "Yes" : "No"} · Tastings/appointments: ${intake.tastingAppointmentChoice}`,
        `Inquiry sources: ${(intake.inquirySources ?? []).join(", ") || "—"}`,
        intake.inquirySourcesOther ? `Other: ${intake.inquirySourcesOther}` : null,
        `Bring business: ${intake.bringBusinessChoice}`,
      ]
        .filter(Boolean)
        .join("\n")
    : null;

  return {
    whiteGloveStatus: enrollmentRes.data?.white_glove_status ?? null,
    accessEmailSentAt: enrollmentRes.data?.access_email_sent_at ?? null,
    stages,
    materials: (materialsRes.data ?? []).map(
      (m: { id: string; file_name: string; public_url: string | null }) => ({
        id: m.id,
        fileName: m.file_name,
        url: m.public_url,
      }),
    ),
    intakeSummary,
    validationIssues: validation.ok ? [] : validation.issues,
  };
}
