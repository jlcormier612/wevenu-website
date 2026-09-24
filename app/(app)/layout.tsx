import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { isPreGraduationAllowedPath } from "@/lib/setup-hub/pre-graduation-paths";
import { isVenueReadyToInviteCouples } from "@/lib/setup-hub/service";
import { getIntakeForVenue } from "@/lib/onboarding/intake-service";
import { needsInitialOwnershipStep } from "@/lib/onboarding/initial-ownership";
import { getActiveVenueMembership } from "@/lib/authorization/membership";
import { bootstrapActiveVenueContext } from "@/lib/venue/active-context";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";
import { recordStaffActivity } from "@/lib/activation/service";

export const dynamic = "force-dynamic";

/**
 * Protected layout for the venue workspace.
 * Wave 2: bootstraps DB-backed active venue context before any venue-scoped work.
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

  // Proxy sets x-pathname on document navigations. Server Action / RSC refreshes
  // can omit it; fall back to Referer so graduation/venue gates do not see "" and
  // fail closed into /setup-hub while the user is still on a Lead Workspace URL.
  const headerList = await headers();
  const pathname = (() => {
    const direct = headerList.get("x-pathname")?.trim() ?? "";
    if (direct.startsWith("/")) return direct.split("?", 1)[0].split("#", 1)[0] ?? direct;
    const referer = headerList.get("referer");
    if (!referer) return "";
    try {
      const path = new URL(referer).pathname;
      return path.startsWith("/") ? path : "";
    } catch {
      return "";
    }
  })();
  const boot = await bootstrapActiveVenueContext();

  if (boot.status === "unauthenticated") {
    redirect("/login");
  }
  if (boot.status === "no_memberships") {
    redirect("/onboarding/intake");
  }
  if (boot.status === "needs_selection") {
    // Case C/E — fail closed; no arbitrary venue. Minimal picker only.
    if (!pathname.startsWith("/select-venue")) {
      redirect("/select-venue");
    }
    return <>{children}</>;
  }

  const venue = await getCurrentVenue();
  if (!venue) {
    // Context claimed ready but venue row missing — fail closed to picker/intake.
    redirect("/select-venue");
  }

  // White Glove: block full product until enrollment is activated (handoff done).
  const admin = createAdminClient();
  const { data: enrollment } = await admin
    .from("venue_enrollments")
    .select("onboarding_type, status, white_glove_status, intake_token, owner_email, owner_first_name, owner_last_name, purchaser_is_owner")
    .eq("venue_id", venue.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      onboarding_type: string;
      status: string;
      white_glove_status: string | null;
      intake_token: string | null;
      owner_email: string;
      owner_first_name: string | null;
      owner_last_name: string | null;
      purchaser_is_owner: boolean | null;
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

  const membership = await getActiveVenueMembership();
  if (enrollment && membership && !pathname.startsWith("/onboarding/ownership")) {
    const { count: ownerCount } = await admin
      .from("venue_staff")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venue.id)
      .eq("is_active", true)
      .or("is_owner.eq.true,owner_invite_pending.eq.true");
    if (
      needsInitialOwnershipStep({
        actorEmail: membership.email,
        enrollment: {
          id: "",
          owner_email: enrollment.owner_email,
          owner_first_name: enrollment.owner_first_name,
          owner_last_name: enrollment.owner_last_name,
          purchaser_is_owner: enrollment.purchaser_is_owner,
        },
        actorIsOwner: membership.isOwner,
        ownerCount: ownerCount ?? 0,
      })
    ) {
      redirect("/onboarding/ownership");
    }
  }

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
      pathname={pathname}
    >
      {children}
    </WorkspaceShell>
  );
}
