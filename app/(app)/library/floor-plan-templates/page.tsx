import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { FloorPlanTemplatesSection } from "@/components/floor-plan-templates/floor-plan-templates-section";
import { getSpaces } from "@/lib/availability/service";
import { getTemplatesForLibrary } from "@/lib/floor-plan-templates/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Floor Plan Templates" };

export default async function FloorPlanTemplatesPage() {
  const [templates, spaces, venue] = await Promise.all([getTemplatesForLibrary(), getSpaces(), getCurrentVenue()]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Floor Plan Templates"
        description="Reusable room layouts a venue builds once and applies to any booking."
      />
      <FloorPlanTemplatesSection initialTemplates={templates} spaces={spaces} venueId={venue?.id ?? ""} />
    </div>
  );
}
