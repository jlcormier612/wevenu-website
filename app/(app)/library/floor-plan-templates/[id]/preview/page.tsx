import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FloorPlanLayoutPreview } from "@/components/floor-plan/floor-plan-layout-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getObjects, getTemplate } from "@/lib/floor-plan-templates/service";
import { getFloorPlanStarterMaster } from "@/lib/floor-plan-templates/starters";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template ? `Preview — ${template.name}` : "Preview floor plan template" };
}

export default async function FloorPlanTemplatePreviewPage({ params }: Props) {
  const { id } = await params;
  const [template, objects] = await Promise.all([getTemplate(id), getObjects(id)]);
  if (!template) notFound();

  const master = template.sourceMasterKey ? getFloorPlanStarterMaster(template.sourceMasterKey) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 max-w-2xl mx-auto">
        <p className="text-sm text-muted-foreground">Preview as your clients will see it</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" render={<Link href={`/library/floor-plan-templates/${template.id}`} />}>
            Back to edit
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/library/floor-plan-templates" />}>
            Library
          </Button>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 pb-10 space-y-4">
        <div className="space-y-1">
          <h1 className="font-heading text-xl font-medium text-heading">{template.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Floor Plan Template</span>
            {template.sourceMasterKey && <Badge variant="muted" className="text-[10px]">Starter</Badge>}
            <span>· {objects.length} {objects.length === 1 ? "element" : "elements"}</span>
          </div>
          {master?.description && <p className="text-sm text-muted-foreground">{master.description}</p>}
          <p className="text-xs text-muted-foreground">
            Illustrative starting layout — resize the room to your real space on your copy after you open the editor.
          </p>
        </div>
        <div className="rounded-lg border border-border overflow-hidden">
          <FloorPlanLayoutPreview
            planName={template.name}
            roomWidthFt={template.roomWidthFt}
            roomDepthFt={template.roomDepthFt}
            backgroundImageUrl={template.backgroundImageUrl}
            backgroundImageOpacity={template.backgroundImageOpacity}
            objects={objects}
            maxHeightClassName="max-h-[75vh]"
          />
        </div>
      </div>
    </div>
  );
}
