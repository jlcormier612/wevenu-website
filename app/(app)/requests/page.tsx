import type { Metadata } from "next";
import { Suspense } from "react";

import { RequestManager } from "@/components/requests/request-manager";
import { NavListBodyFallback } from "@/components/shell/nav-list-body-fallback";
import { getClients } from "@/lib/clients/service";
import { getRequests } from "@/lib/requests/service";
import { getTeamMembers } from "@/lib/team/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Requests — Hello to Cheers" };

async function RequestsBodyIsland() {
  const venue = await getCurrentVenue();
  const [requests, clients, teamMembers] = await Promise.all([
    getRequests(),
    getClients(),
    venue ? getTeamMembers(venue.id) : Promise.resolve([]),
  ]);

  return (
    <RequestManager initialRequests={requests} clients={clients} teamMembers={teamMembers} />
  );
}

/**
 * The venue's Request Dashboard — everything asked of a couple or vendor,
 * across every booking, in one place: filter, assign, and track status.
 */
export default function RequestsPage() {
  return (
    <div
      className="htc-hospitality-page space-y-5 sm:space-y-6"
      data-htc-phase12="requests"
      data-testid="requests-streaming-root"
    >
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <div>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-heading">Requests</h1>
          <p className="mt-1 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">
            Everything you&apos;ve asked a couple or vendor to do, across every booking — assign it,
            track it, and see where it stands.
          </p>
        </div>
      </div>
      <Suspense fallback={<NavListBodyFallback label="Loading requests" />}>
        <RequestsBodyIsland />
      </Suspense>
    </div>
  );
}
