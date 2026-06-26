import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Clients" };

export default function ClientsPage() {
  return (
    <ModulePlaceholder
      title="Clients"
      description="Manage the couples and organizers behind your booked events."
    />
  );
}
