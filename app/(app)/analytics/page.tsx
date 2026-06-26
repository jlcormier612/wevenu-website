import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <ModulePlaceholder
      title="Analytics"
      description="Understand conversion, revenue and venue performance."
    />
  );
}
