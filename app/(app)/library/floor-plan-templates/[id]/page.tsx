import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FloorPlanTemplateEditor } from "@/components/floor-plan-templates/floor-plan-template-editor";
import { FloorPlanTemplateEditorHeader } from "@/components/floor-plan-templates/floor-plan-template-editor-header";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div
      className="htc-hospitality-page space-y-5 sm:space-y-6"
      data-htc-phase12="floor-plan-template-edit"
    >
      <CollectionBackLink href="/library/floor-plan-templates" label="Floor Plan Templates" />
      <FloorPlanTemplateEditorHeader
        template={template}
        spaces={spaces}
        spaceName={spaceName}
        objectCount={objects.length}
        masterDescription={master?.description ?? null}
        acceptedEventTypes={acceptedEventTypes}
      />
      <Card className="htc-working-card gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle>Layout editor</CardTitle>
          <CardDescription>
            Place furniture and labels on this reusable layout. Changes save as you edit.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <FloorPlanTemplateEditor
            templateId={id}
            venueId={venue.id}
            initialPlan={{ ...template, objects }}
            inventoryItems={inventoryItems}
            inventoryCategories={inventoryCategories}
            readOnly={!canEditFloorPlans(role)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
