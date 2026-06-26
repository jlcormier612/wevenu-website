import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Leads" };

export default function LeadsPage() {
  return (
    <ModulePlaceholder
      title="Leads"
      description="Capture and nurture inquiries through your booking pipeline."
    />
  );
}
