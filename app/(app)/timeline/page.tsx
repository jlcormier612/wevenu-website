import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Timeline" };

export default function TimelinePage() {
  return (
    <ModulePlaceholder
      title="Timeline"
      description="Build and share the run-of-show for each event."
    />
  );
}
