import type { Metadata } from "next";
import Link from "next/link";

import { ClientList } from "@/components/clients/client-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getClients } from "@/lib/clients/service";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const clients = await getClients();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Booked couples and their events."
        actions={
          <Button render={<Link href="/clients/new" />}>
            + New Client
          </Button>
        }
      />
      <ClientList clients={clients} />
    </div>
  );
}
