import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FloorPlanTemplateEditor } from "@/components/floor-plan-templates/floor-plan-template-editor";
import { FloorPlanTemplateEditorHeader } from "@/components/floor-plan-templates/floor-plan-template-editor-header";
import { getSpaces } from "@/lib/availability/service";
import { canEditFloorPlans } from "@/lib/floor-plans/authorize";
import { getObjects, getTemplate } from "@/lib/floor-plan-templates/service";
import { getFloorPlanStarterMaster } from "@/lib/floor-plan-templates/starters";
import { getInquiryFormSettings } from "@/lib/inquiry-form/service";
import { getCategories, getFloorPlanEligibleItems } from "@/lib/inventory/service";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template ? `${template.name} — Floor Plan Templates` : "Floor Plan Template Editor" };
}

export default async function FloorPlanTemplateEditorPage({ params }: Props) {
  const { id } = await params;
  const [template, objects, spaces, venue, inventoryItems, inventoryCategories, role, inquirySettings] = await Promise.all([
    getTemplate(id), getObjects(id), getSpaces(), getCurrentVenue(), getFloorPlanEligibleItems(), getCategories(),
    getCurrentUserRole(), getInquiryFormSettings(),
  ]);
  if (!template || !venue) notFound();

  const spaceName = template.spaceId ? spaces.find((s) => s.id === template.spaceId)?.name ?? null : null;
  const master = template.sourceMasterKey
    ? getFloorPlanStarterMaster(template.sourceMasterKey)
    : undefined;
  const acceptedEventTypes = inquirySettings?.acceptedEventTypes ?? [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link href="/library/floor-plan-templates" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Floor Plan Templates
      </Link>
      <FloorPlanTemplateEditorHeader
        template={template}
        spaces={spaces}
        spaceName={spaceName}
        objectCount={objects.length}
        masterDescription={master?.description ?? null}
        acceptedEventTypes={acceptedEventTypes}
      />
      <FloorPlanTemplateEditor
        templateId={id}
        venueId={venue.id}
        initialPlan={{ ...template, objects }}
        inventoryItems={inventoryItems}
        inventoryCategories={inventoryCategories}
        readOnly={!canEditFloorPlans(role)}
      />
    </div>
  );
}
