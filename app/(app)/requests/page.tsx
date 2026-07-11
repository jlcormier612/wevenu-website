import type { Metadata } from "next";

import { RequestManager } from "@/components/requests/request-manager";
import { getClients } from "@/lib/clients/service";
import { getRequests } from "@/lib/requests/service";
import { getTeamMembers } from "@/lib/team/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Requests (Internal) — Wevenu" };

/**
 * Internal-only verification page for the Request Framework Foundation.
 * Not the Client Workspace UI — just enough to confirm requests can be
 * created, moved through their lifecycle, assigned, and completed. No
 * existing feature reads from or writes to Requests yet.
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
        <h1 className="text-2xl font-semibold">Requests (Internal)</h1>
        <p className="text-sm text-muted-foreground">
          Framework verification page — create, assign, and move requests through their lifecycle.
        </p>
      </div>
      <RequestManager initialRequests={requests} clients={clients} teamMembers={teamMembers} />
    </div>
  );
}
