import type { Metadata } from "next";

import { RequestManager } from "@/components/requests/request-manager";
import { getClients } from "@/lib/clients/service";
import { getRequests } from "@/lib/requests/service";
import { getTeamMembers } from "@/lib/team/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Requests — Wevenu" };

/**
 * The venue's Request Dashboard — everything asked of a couple or vendor,
 * across every booking, in one place: filter, assign, and track status.
 * Started as an internal verification-only page (Request Framework
 * Foundation); RequestManager itself was already completed into the real
 * venue-side experience (Wedding Workspace – Request Experience, Phase 1) —
 * this entry point's own copy just never caught up (Planning Execution —
 * Experience Completion).
 */
export default async function RequestsPage() {
  const venue = await getCurrentVenue();
  const [requests, clients, teamMembers] = await Promise.all([
    getRequests(),
    getClients(),
    venue ? getTeamMembers(venue.id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Requests</h1>
        <p className="text-sm text-muted-foreground">
          Everything you&apos;ve asked a couple or vendor to do, across every booking — assign it, track it, and see where it stands.
        </p>
      </div>
      <RequestManager initialRequests={requests} clients={clients} teamMembers={teamMembers} />
    </div>
  );
}
