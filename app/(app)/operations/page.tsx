import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Operations" };

export default function OperationsPage() {
  return (
    <ModulePlaceholder
      title="Operations"
      description="Internal operations and team administration."
    />
  );
}
