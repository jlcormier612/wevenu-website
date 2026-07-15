import type { Metadata } from "next";
import Link from "next/link";

import { RequestDetail } from "@/components/requests/request-detail";
import { getClients } from "@/lib/clients/service";
import { getRequest, getRequestHistory } from "@/lib/requests/service";
import { getTeamMembers } from "@/lib/team/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Request — Wevenu" };

type Props = { params: Promise<{ id: string }> };

/**
 * A single Request's own record — the page a Request is opened to (e.g.
 * from Planning's "Open Request" link). Not the Client Workspace UI; not a
 * redesign of any feature that links to it.
 */
export default async function RequestDetailPage({ params }: Props) {
  const { id } = await params;
  const venue = await getCurrentVenue();
  const [request, clients, teamMembers, history] = await Promise.all([
    getRequest(id),
    getClients(),
    venue ? getTeamMembers(venue.id) : Promise.resolve([]),
    getRequestHistory(id),
  ]);

  if (!request) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Request not found.</p>
        <Link href="/requests" className="text-sm underline">Back to Requests</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/requests" className="text-sm text-muted-foreground underline">← Back to Requests</Link>
      <RequestDetail initialRequest={request} clients={clients} teamMembers={teamMembers} initialHistory={history} />
    </div>
  );
}
