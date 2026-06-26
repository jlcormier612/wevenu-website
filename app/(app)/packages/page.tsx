import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Packages & Inventory" };

export default function PackagesPage() {
  return (
    <ModulePlaceholder
      title="Packages & Inventory"
      description="Define packages and manage inventory across events."
    />
  );
}
