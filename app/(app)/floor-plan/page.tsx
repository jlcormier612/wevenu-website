import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Floor Plan" };

export default function FloorPlanPage() {
  return (
    <ModulePlaceholder
      title="Floor Plan"
      description="Design room layouts and seating arrangements."
    />
  );
}
