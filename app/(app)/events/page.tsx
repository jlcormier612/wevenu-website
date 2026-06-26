import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage() {
  return (
    <ModulePlaceholder
      title="Events"
      description="The single source of truth for every booked event."
    />
  );
}
