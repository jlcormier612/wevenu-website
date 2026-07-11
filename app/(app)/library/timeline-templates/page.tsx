import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { TimelineTemplatesSection } from "@/components/timeline-templates/timeline-templates-section";
import { getSpaces } from "@/lib/availability/service";
import { getTemplatesForLibrary } from "@/lib/timeline-templates/service";

export const metadata: Metadata = { title: "Timeline Templates" };

export default async function TimelineTemplatesPage() {
  const [templates, spaces] = await Promise.all([getTemplatesForLibrary(), getSpaces()]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Timeline Templates"
        description="Reusable day-of schedules a venue builds once and applies to any booking."
      />
      <TimelineTemplatesSection initialTemplates={templates} spaces={spaces} />
    </div>
  );
}
