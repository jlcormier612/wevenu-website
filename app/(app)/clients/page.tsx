import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ClientList } from "@/components/clients/client-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getClientAttentionFlags, getClients } from "@/lib/clients/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { venueToday } from "@/lib/venue/timezone";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const [clients, attentionClientIds, venue] = await Promise.all([
    getClients(),
    getClientAttentionFlags(),
    getCurrentVenue(),
  ]);
  const today = venueToday(venue?.timezone ?? null);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Booked clients and their events."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" render={<Link href="/settings/import?type=couples" />}>Import Clients / Bookings</Button>
            <Button render={<Link href="/clients/new" />}>+ New Client</Button>
          </div>
        }
      />
      <Suspense fallback={null}>
        <ClientList clients={clients} attentionClientIds={attentionClientIds} today={today} />
      </Suspense>
    </div>
  );
}
