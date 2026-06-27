import type { Metadata } from "next";
import Link from "next/link";

import { ClientList } from "@/components/clients/client-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { CLIENT_STATUSES } from "@/lib/clients/constants";
import { getClients } from "@/lib/clients/service";

export const metadata: Metadata = { title: "Clients" };

type Props = { searchParams: Promise<{ q?: string; status?: string }> };

export default async function ClientsPage({ searchParams }: Props) {
  const { q, status } = await searchParams;
  const clients = await getClients({ q, status });
  const statusOptions = CLIENT_STATUSES.map((s) => ({ value: s.value, label: s.label }));
  return (
    <div className="space-y-5">
      <PageHeader
        title="Clients"
        description="Booked couples and their events."
        actions={<Button render={<Link href="/clients/new" />}>+ New Client</Button>}
      />
      <FilterBar placeholder="Search clients by name or email…" statusOptions={statusOptions} />
      {(q || status) && (
        <p className="text-xs text-muted-foreground">{clients.length} result{clients.length !== 1 ? "s" : ""}{q ? ` matching "${q}"` : ""}{status ? ` · ${statusOptions.find((s) => s.value === status)?.label}` : ""}</p>
      )}
      <ClientList clients={clients} />
    </div>
  );
}
