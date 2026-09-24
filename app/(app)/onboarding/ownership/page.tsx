import { redirect } from "next/navigation";

import { getActiveVenueMembership } from "@/lib/authorization/membership";
import { getTeamMembers } from "@/lib/team/service";
import {
  getEnrollmentOwnershipForVenue,
  needsInitialOwnershipStep,
  needsPurchaserOwnershipQuestion,
  setupPersonDisplayName,
} from "@/lib/onboarding/initial-ownership";
import { getCurrentVenue } from "@/lib/venue/service";
import { isSupabaseConfigured } from "@/lib/env";
import { InitialOwnershipClient } from "@/components/onboarding/initial-ownership-client";

export const dynamic = "force-dynamic";

export default async function InitialOwnershipPage() {
  if (!isSupabaseConfigured) redirect("/login");
  const venue = await getCurrentVenue();
  const membership = await getActiveVenueMembership();
  if (!venue || !membership) redirect("/login");

  const enrollment = await getEnrollmentOwnershipForVenue(venue.id);
  const owners = (await getTeamMembers(venue.id)).filter(
    (m) => m.isOwner || m.ownerInvitePending,
  );
  if (
    !needsInitialOwnershipStep({
      actorEmail: membership.email,
      enrollment,
      actorIsOwner: membership.isOwner,
      ownerCount: owners.length,
    })
  ) {
    redirect("/onboarding/intake");
  }

  const setupPersonName = setupPersonDisplayName({
    owner_first_name: enrollment?.owner_first_name,
    owner_last_name: enrollment?.owner_last_name,
    fallbackName: membership.fullName,
    fallbackEmail: membership.email,
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <InitialOwnershipClient
        setupPersonName={setupPersonName}
        setupPersonEmail={membership.email ?? ""}
        askOwnershipQuestion={needsPurchaserOwnershipQuestion({
          actorEmail: membership.email,
          enrollment,
          actorIsOwner: membership.isOwner,
        })}
        owners={owners}
        actorStaffId={membership.staffId}
      />
    </div>
  );
}
