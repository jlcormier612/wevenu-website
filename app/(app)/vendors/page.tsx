import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Vendors" };

export default function VendorsPage() {
  return (
    <ModulePlaceholder
      title="Vendors"
      description="Coordinate the vendors participating in your events."
    />
  );
}
