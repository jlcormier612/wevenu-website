import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <ModulePlaceholder
      title="Calendar"
      description="View and manage venue availability, tours and events."
    />
  );
}
