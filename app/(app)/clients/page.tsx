import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ClientList } from "@/components/clients/client-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import {
  THREE_COUPLES_PORTAL_TARGET,
  portalActivationState,
} from "@/lib/activation/portal-open-milestone";
import { getBookedClientPortalActivationRows } from "@/lib/activation/portal-open-milestone-service";
import { getCanonicallyBookedClientIds } from "@/lib/booking-journey/canonical-booked";
import { getClientAttentionFlags, getClients } from "@/lib/clients/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { venueToday } from "@/lib/venue/timezone";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const [clients, attentionClientIds, venue, bookedIds] = await Promise.all([
    getClients(),
    getClientAttentionFlags(),
    getCurrentVenue(),
    getCanonicallyBookedClientIds(),
  ]);
  const today = venueToday(venue?.timezone ?? null);

  const portalRows = venue
    ? await getBookedClientPortalActivationRows(venue.id, bookedIds)
    : new Map();
  let openedCount = 0;
  const portalActivationByClientId: Record<string, {
    state: ReturnType<typeof portalActivationState>;
    invitationId: string | null;
    invitationStatus: "pending" | "accepted" | "revoked" | null;
  }> = {};
  for (const [clientId, row] of portalRows) {
    const state = portalActivationState({
      lastAccessedAt: row.lastAccessedAt,
      invitationStatus: row.invitationStatus,
    });
    if (state === "opened") openedCount += 1;
    portalActivationByClientId[clientId] = {
      state,
      invitationId: row.invitationId,
      invitationStatus: row.invitationStatus,
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="All Bookings is the active book. Coming up is event dates from today through the next 30 days. Needs Attention is an active booking with a past-due payment, a past-due required task, or a message that needs a response. Cancelled and Past are history."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" render={<Link href="/settings/import?type=couples" />}>Import Clients</Button>
            <Button render={<Link href="/clients/new" />}>+ New Client</Button>
          </div>
        }
      />
      <Suspense fallback={null}>
        <ClientList
          clients={clients}
          attentionClientIds={attentionClientIds}
          bookedClientIds={bookedIds}
          today={today}
          portalActivationByClientId={portalActivationByClientId}
          portalActivationProgress={{
            opened: openedCount,
            target: THREE_COUPLES_PORTAL_TARGET,
          }}
        />
      </Suspense>
    </div>
  );
}
