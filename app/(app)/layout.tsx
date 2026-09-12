import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { isPreGraduationAllowedPath } from "@/lib/setup-hub/pre-graduation-paths";
import { isVenueReadyToInviteCouples } from "@/lib/setup-hub/service";
import { getIntakeForVenue } from "@/lib/onboarding/intake-service";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";
import { recordStaffActivity } from "@/lib/activation/service";

export const dynamic = "force-dynamic";

/**
 * Protected layout for the venue workspace.
 * Graduation gate: ready_to_invite_couples only (not venues.setup_completed).
 * White Glove customers without completed handoff/activation stay out of the
 * product workspace (waiting / intake is token-scoped outside this layout).
 */
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured) {
    redirect("/login");
  }

  const supabase = await createClient("venue");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const venue = await getCurrentVenue();
  if (!venue) {
    // No venue — enrollment activate should have provisioned one. Keep a thin
    // handoff, never the legacy wizard.
    redirect("/onboarding/intake");
  }

  // White Glove: block full product until enrollment is activated (handoff done).
  const admin = createAdminClient();
  const { data: enrollment } = await admin
    .from("venue_enrollments")
    .select("onboarding_type, status, white_glove_status, intake_token, owner_email")
    .eq("venue_id", venue.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      onboarding_type: string;
      status: string;
      white_glove_status: string | null;
      intake_token: string | null;
      owner_email: string;
    }>();

  if (
    enrollment?.onboarding_type === "white_glove" &&
    enrollment.status !== "activated"
  ) {
    // Gate the venue owner only — HQ operators with temporary staff access
    // must reach Setup Hub on the real venue.
    const isOwnerCustomer =
      Boolean(user.email) &&
      user.email!.trim().toLowerCase() === enrollment.owner_email.trim().toLowerCase();

    if (isOwnerCustomer) {
      if (enrollment.intake_token) {
        const waiting =
          enrollment.white_glove_status === "waiting" ||
          enrollment.white_glove_status === "in_progress" ||
          enrollment.white_glove_status === "setup_complete_access_pending";
        redirect(
          waiting
            ? `/onboarding/white-glove/${encodeURIComponent(enrollment.intake_token)}/waiting`
            : `/onboarding/white-glove/${encodeURIComponent(enrollment.intake_token)}`,
        );
      }
      redirect("/login");
    }
  }

  const pathname = (await headers()).get("x-pathname") ?? "";
  const intake = await getIntakeForVenue(venue.id);
  if (
    enrollment?.onboarding_type !== "white_glove" &&
    !intake?.submittedAt &&
    !pathname.startsWith("/onboarding")
  ) {
    redirect("/onboarding/intake");
  }

  const ready = await isVenueReadyToInviteCouples(venue.id);
  if (!ready) {
    if (!isPreGraduationAllowedPath(pathname)) {
      redirect("/setup-hub");
    }
  }

  if (venue.accessDisabled || venue.accountStatus === "suspended") {
    redirect("/billing/suspended");
  }

  void recordStaffActivity(user.id);
  const staffRole = await getCurrentUserRole();

  return (
    <WorkspaceShell
      email={user.email ?? ""}
      venueName={venue.name}
      venueLogo={venue.logoUrl}
      staffRole={staffRole}
    >
      {children}
    </WorkspaceShell>
  );
}
