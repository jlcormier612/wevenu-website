import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FloorPlanTemplateEditor } from "@/components/floor-plan-templates/floor-plan-template-editor";
import { Badge } from "@/components/ui/badge";
import { getSpaces } from "@/lib/availability/service";
import { eventTypeLabel } from "@/lib/leads/constants";
import { getObjects, getTemplate } from "@/lib/floor-plan-templates/service";
import { getFloorPlanStarterMaster } from "@/lib/floor-plan-templates/starters";
import { getCategories, getFloorPlanEligibleItems } from "@/lib/inventory/service";
import { getCurrentVenue } from "@/lib/venue/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template ? `${template.name} — Floor Plan Templates` : "Floor Plan Template Editor" };
}

export default async function FloorPlanTemplateEditorPage({ params }: Props) {
  const { id } = await params;
  const [template, objects, spaces, venue, inventoryItems, inventoryCategories] = await Promise.all([
    getTemplate(id), getObjects(id), getSpaces(), getCurrentVenue(), getFloorPlanEligibleItems(), getCategories(),
  ]);
  if (!template || !venue) notFound();

  const spaceName = template.spaceId ? spaces.find((s) => s.id === template.spaceId)?.name ?? null : null;
  const master = template.sourceMasterKey
    ? getFloorPlanStarterMaster(template.sourceMasterKey)
    : undefined;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="space-y-1">
        <Link href="/library/floor-plan-templates" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Floor Plan Templates
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-medium text-heading">{template.name}</h1>
          {template.sourceMasterKey && <Badge variant="muted">Starter</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {template.eventType ? eventTypeLabel(template.eventType) : "Any event type"}
          {spaceName ? ` · ${spaceName}` : ""} · {objects.length} item{objects.length !== 1 ? "s" : ""}
        </p>
        {master?.description && (
          <p className="text-sm text-muted-foreground max-w-2xl">{master.description}</p>
        )}
      </div>
      <FloorPlanTemplateEditor
        templateId={id}
        venueId={venue.id}
        initialPlan={{ ...template, objects }}
        inventoryItems={inventoryItems}
        inventoryCategories={inventoryCategories}
      />
    </div>
  );
}
