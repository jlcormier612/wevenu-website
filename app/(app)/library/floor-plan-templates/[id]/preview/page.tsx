import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FloorPlanLayoutPreview } from "@/components/floor-plan/floor-plan-layout-preview";
import { LibraryPreviewChrome } from "@/components/library/library-preview-chrome";
import { Badge } from "@/components/ui/badge";
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
    <LibraryPreviewChrome
      caption="Floor plan template preview — illustrative layout only. Not a capacity claim. Clients see a working floor plan after you apply this to an event."
      editHref={`/library/floor-plan-templates/${template.id}`}
      libraryHref="/library/floor-plan-templates"
      contentMaxWidthClassName="max-w-2xl"
    >
      <div className="space-y-4 pb-10">
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
    </LibraryPreviewChrome>
  );
}
