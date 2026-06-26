import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Contracts" };

export default function ContractsPage() {
  return (
    <ModulePlaceholder
      title="Contracts"
      description="Prepare, send and track contracts and e-signatures."
    />
  );
}
