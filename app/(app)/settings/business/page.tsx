import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

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
 * When opened from Setup Hub Milestone 02, shows the approved venue-profile copy
 * on the same editor — no second source of truth.
 */
export default async function BusinessBrandSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const fromRaw = params.from;
  const from = Array.isArray(fromRaw) ? fromRaw[0] : fromRaw;
  const fromSetupHub = from === "setup-hub";
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
  const actorClarity = membership
    ? {
        staffId: membership.staffId,
        name: membership.fullName,
        accessTitle: membership.accessTitle,
        isOwner: membership.isOwner,
      }
    : null;

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      {fromSetupHub ? (
        <div className="mx-auto max-w-[960px] space-y-4" data-testid="phase-a-venue-profile">
          <Link
            href="/setup-hub/make-htc-yours"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-heading"
            data-testid="phase-a-back-to-milestone-02"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Back to Make HTC yours
          </Link>
          <header className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              YOUR VENUE
            </p>
            <h1 className="font-heading text-3xl font-medium tracking-tight text-heading">
              Make it yours.
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Let&apos;s start with the details that make your venue unique. We&apos;ll use this
              information to personalize your workspace and help prepare the experience you&apos;ll
              share with your clients.
            </p>
          </header>
        </div>
      ) : (
        <>
          <div className="htc-hospitality-heading htc-hospitality-intro-accent">
            <PageHeader
              title="Business & Brand"
              description="Your venue information, appearance, owners, and public-facing details."
            />
          </div>
          <SettingsTabs />
        </>
      )}
      {settings ? (
        <div className={fromSetupHub ? "mx-auto max-w-[960px]" : undefined}>
          <VenueSettings
            initial={settings.input}
            venueId={settings.venueId}
            publicReviewUrl={venue?.publicReviewUrl ?? ""}
            owners={owners}
            actorIsOwner={actorIsOwner}
            actorCanManageOwners={actorCanManageOwners}
            actorStaffId={membership?.staffId ?? null}
            actorClarity={actorClarity}
            fromSetupHub={fromSetupHub}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Your venue settings could not be loaded. Please refresh the page.
        </p>
      )}
    </div>
  );
}
