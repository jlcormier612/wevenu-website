import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentVenue } from "@/lib/venue/service";
import { getTeamMembers } from "@/lib/team/service";
import { PageHeader } from "@/components/shell/module-placeholder";
import { DataExportSection } from "@/components/settings/data-export-section";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { TeamRoster } from "@/components/settings/team-roster";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Team & Data — Settings" };

/**
 * Settings > Team & Data. Team & Permissions is the existing, unchanged
 * TeamRoster (invite/remove/role-change, RLS-backed) — release-critical
 * per the Manager Permissions work, so nothing about its behavior,
 * actions, or underlying authorization is touched here. Import/Export
 * moved in from the old flat Settings page unchanged.
 */
export default async function TeamDataSettingsPage() {
  const venue = await getCurrentVenue();
  if (!venue) return null;

  const members = await getTeamMembers(venue.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team & Data"
        description="Manage your team, permissions, imports, and venue data."
      />
      <SettingsTabs />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team &amp; Permissions</CardTitle>
          <CardDescription>
            Manage who has access to your venue and what they can see and do.
            Owners and Managers can invite or remove members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamRoster initialMembers={members} venueId={venue.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import Existing Data</CardTitle>
          <CardDescription>
            Bring your clients, leads, vendors, inventory, and packages into Hello to Cheers from any CSV export. No template required — map your own column names.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href="/settings/import?type=couples" className="text-sm font-medium text-primary hover:underline">Import Clients →</Link>
            <Link href="/settings/import?type=leads" className="text-sm font-medium text-primary hover:underline">Import Leads →</Link>
            <Link href="/settings/import?type=vendors" className="text-sm font-medium text-primary hover:underline">Import Vendors →</Link>
            <Link href="/settings/import?type=inventory" className="text-sm font-medium text-primary hover:underline">Import Inventory →</Link>
            <Link href="/settings/import?type=packages" className="text-sm font-medium text-primary hover:underline">Import Packages →</Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Migration Center</CardTitle>
          <CardDescription>
            Switching from another venue-management system? Bring over your existing clients, leads, and vendors — we'll recognize duplicates and import quietly, with no surprise emails to your customers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/settings/migration" className="text-sm font-medium text-primary hover:underline">Open Migration Center →</Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Data</CardTitle>
          <CardDescription>
            Your data belongs to you. Download a complete copy of your clients, events, contracts,
            invoices, and payment records at any time — no need to ask, no waiting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataExportSection />
        </CardContent>
      </Card>
    </div>
  );
}
