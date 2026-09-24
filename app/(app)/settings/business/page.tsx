import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { VenueSettings } from "@/components/settings/venue-settings";
import { getCurrentVenue, getVenueSettings } from "@/lib/venue/service";
import { getTeamMembers } from "@/lib/team/service";
import { getActiveVenueMembership } from "@/lib/authorization/membership";
import {
  canSetupPurchaserEstablishOwners,
  getEnrollmentOwnershipForVenue,
} from "@/lib/onboarding/initial-ownership";

export const metadata: Metadata = { title: "Business & Brand — Settings" };

/**
 * Settings > Business & Brand. Venue identity + Owners (relocated from Team).
 * Owner invite/remove reuses existing venue_staff.is_owner + inviteStaffMember.
 */
export default async function BusinessBrandSettingsPage() {
  const [settings, venue, membership] = await Promise.all([
    getVenueSettings(),
    getCurrentVenue(),
    getActiveVenueMembership(),
  ]);

  const owners = venue
    ? (await getTeamMembers(venue.id)).filter(
        (m) => m.isOwner || m.ownerInvitePending,
      )
    : [];
  const enrollment = venue ? await getEnrollmentOwnershipForVenue(venue.id) : null;
  const actorIsOwner = membership?.isOwner === true;
  const actorIsActive = membership?.isActive === true;
  const actorCanManageOwners =
    actorIsOwner
    || canSetupPurchaserEstablishOwners({
      isOwner: actorIsOwner,
      isActive: actorIsActive,
      accessTitle: membership?.accessTitle ?? "staff",
      actorEmail: membership?.email,
      enrollment,
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business & Brand"
        description="Your venue information, appearance, owners, and public-facing details."
      />
      <SettingsTabs />
      {settings ? (
        <VenueSettings
          initial={settings.input}
          venueId={settings.venueId}
          publicReviewUrl={venue?.publicReviewUrl ?? ""}
          owners={owners}
          actorIsOwner={actorIsOwner}
          actorCanManageOwners={actorCanManageOwners}
          actorStaffId={membership?.staffId ?? null}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Your venue settings could not be loaded. Please refresh the page.
        </p>
      )}
    </div>
  );
}
