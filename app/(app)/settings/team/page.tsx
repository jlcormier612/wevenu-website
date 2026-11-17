import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentVenue } from "@/lib/venue/service";
import { getTeamMembers } from "@/lib/team/service";
import { hasCapability } from "@/lib/authorization";
import { canExportVenueData } from "@/lib/authorization/export-access";
import { getActiveVenueMembership } from "@/lib/authorization/membership";
import { PageHeader } from "@/components/shell/module-placeholder";
import { DataExportSection } from "@/components/settings/data-export-section";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { TeamRoster } from "@/components/settings/team-roster";
import { VenueRepresentationSection } from "@/components/settings/venue-representation-section";
import { normalizeVenuePhoneInput } from "@/lib/sms/phone";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Team & Data — Settings" };

export default async function TeamDataSettingsPage() {
  const venue = await getCurrentVenue();
  if (!venue) return null;

  const [members, membership] = await Promise.all([
    getTeamMembers(venue.id),
    getActiveVenueMembership(),
  ]);

  const actorIsOwner = membership?.isOwner === true;
  const canInvite =
    actorIsOwner || (membership ? hasCapability(membership, "team.invite") : false);
  const canChangeAccess =
    actorIsOwner || (membership ? hasCapability(membership, "team.change_access") : false);
  const canRemove =
    actorIsOwner || (membership ? hasCapability(membership, "team.remove") : false);
  const canExport = membership ? canExportVenueData(membership) : false;

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Team & Data"
          description="Manage your team, permissions, imports, and venue data."
        />
      </div>
      <SettingsTabs />

      <VenueRepresentationSection
        initialEmail={venue.email ?? ""}
        initialPhone={normalizeVenuePhoneInput(venue.phone ?? "")}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team &amp; Permissions</CardTitle>
          <CardDescription>
            Owners have full access to the venue, including team, settings, billing, and
            account ownership. Add people who help run your venue below — choose the access
            level that fits their role, and customize individual permissions when needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamRoster
            initialMembers={members}
            venueId={venue.id}
            actorIsOwner={actorIsOwner}
            actorStaffId={membership?.staffId ?? null}
            canInvite={canInvite}
            canChangeAccess={canChangeAccess}
            canRemove={canRemove}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bring your business with you</CardTitle>
          <CardDescription>
            Bring over people, dates, bookings, agreements, and planning files in one recommended journey. You can skip a stage and come back later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link href="/setup-hub/bring-your-business" className="text-sm font-medium text-primary hover:underline">Open Bring Your Business →</Link>
          <div>
            <Link href="/help/what-should-i-set-up-before-i-start" className="text-xs text-muted-foreground hover:text-primary hover:underline">
              How to bring your business over →
            </Link>
          </div>
        </CardContent>
      </Card>

      {canExport ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Data</CardTitle>
            <CardDescription>
              Download a ZIP file containing this venue&apos;s business records and uploaded files, including leads, clients, events, contracts, invoices, payments, messages, and uploaded documents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataExportSection />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
