import type { Metadata } from "next";
import { getCurrentVenue } from "@/lib/venue/service";
import { getTeamMembers } from "@/lib/team/service";
import { PageHeader } from "@/components/shell/module-placeholder";
import { TeamRoster } from "@/components/settings/team-roster";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Team" };

export default async function TeamSettingsPage() {
  const venue = await getCurrentVenue();
  if (!venue) return null;

  const members = await getTeamMembers(venue.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Invite coordinators and staff to access the workspace."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Members</CardTitle>
          <CardDescription>
            Invited members can access clients, events, and vendors. Only the
            owner can invite or remove members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamRoster initialMembers={members} venueId={venue.id} />
        </CardContent>
      </Card>
    </div>
  );
}
