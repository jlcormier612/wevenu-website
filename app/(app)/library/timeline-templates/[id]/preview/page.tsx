import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getItems, getTemplate } from "@/lib/timeline-templates/service";
import { getTimelineStarterMaster } from "@/lib/timeline-templates/starters";
import {
  formatStarterTimelineDayLabel,
  groupTimelineItemsByDay,
} from "@/lib/timeline-templates/constants";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template ? `Preview — ${template.name}` : "Preview timeline template" };
}

export default async function TimelineTemplatePreviewPage({ params }: Props) {
  const { id } = await params;
  const [template, items] = await Promise.all([getTemplate(id), getItems(id)]);
  if (!template) notFound();

  const master = template.sourceMasterKey ? getTimelineStarterMaster(template.sourceMasterKey) : undefined;
  const groups = groupTimelineItemsByDay(items);
  const multiDay = groups.length > 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 max-w-xl mx-auto">
        <p className="text-sm text-muted-foreground">Preview as your clients will see it</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" render={<Link href={`/library/timeline-templates/${template.id}`} />}>
            Back to edit
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/library/timeline-templates" />}>
            Library
          </Button>
        </div>
      </div>
      <div className="max-w-xl mx-auto px-4 pb-10 space-y-4">
        <div className="space-y-1">
          <h1 className="font-heading text-xl font-medium text-heading">{template.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Timeline Template</span>
            {template.sourceMasterKey && <Badge variant="muted" className="text-[10px]">Starter</Badge>}
            <span>· {items.length} {items.length === 1 ? "activity" : "activities"}</span>
          </div>
          {master?.description && <p className="text-sm text-muted-foreground">{master.description}</p>}
          <p className="text-xs text-muted-foreground">
            Activities and sequence only — add times on the Working Timeline after you apply this template.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background p-6 space-y-4">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activities yet.</p>
          ) : (
            groups.map((group) => (
              <div key={group.dayOffset} className="space-y-1.5">
                {multiDay && (
                  <p className="text-xs font-medium text-heading">
                    {formatStarterTimelineDayLabel(group.dayOffset, template.sourceMasterKey)}
                  </p>
                )}
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.id} className="text-sm text-foreground">· {item.title}</li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
