import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LibraryPreviewChrome } from "@/components/library/library-preview-chrome";
import { Badge } from "@/components/ui/badge";
import {
  applyPreviewKindCopy,
  formatTemplateReminder,
  groupTasksForApplyPreview,
} from "@/lib/playbooks/apply-preview";
import { formatShortDaysOffset } from "@/lib/playbooks/due-dates";
import { getMilestones, getTemplate, getTemplateTasks } from "@/lib/playbooks/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template ? `Preview — ${template.name}` : "Preview checklist" };
}

export default async function PlaybookTemplatePreviewPage({ params }: Props) {
  const { id } = await params;
  const [template, milestones, tasks] = await Promise.all([
    getTemplate(id),
    getMilestones(id),
    getTemplateTasks(id),
  ]);
  if (!template) notFound();

  const kindCopy = applyPreviewKindCopy(template.kind);
  const groups = groupTasksForApplyPreview(milestones, tasks);
  const taskCount = groups.reduce((n, g) => n + g.taskTitles.length, 0);
  const caption =
    template.kind === "client"
      ? "Preview of the client planning checklist structure. Clients see tasks only after you apply and release this on an event."
      : "Venue planning checklist preview — for your team, not shown to clients as this Library template.";

  return (
    <LibraryPreviewChrome
      caption={caption}
      editHref={`/library/playbooks/${template.id}`}
      libraryHref="/library/playbooks"
      contentMaxWidthClassName="max-w-xl"
    >
      <div className="space-y-4 pb-10">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent" className="text-[10px]">{kindCopy.label}</Badge>
            {template.sourceMasterKey && <Badge variant="muted" className="text-[10px]">Starter</Badge>}
          </div>
          <h1 className="font-heading text-xl font-medium text-heading">{template.name}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{kindCopy.explanation}</p>
          <p className="text-xs text-muted-foreground">
            {groups.length} milestone{groups.length === 1 ? "" : "s"} · {taskCount} task{taskCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background p-6">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">This template doesn&apos;t have any tasks yet.</p>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.milestoneId} className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.milestoneName}
                  </p>
                  <ul className="space-y-1 rounded-lg border border-border bg-muted/20 px-3 py-2">
                    {g.tasks.map((task, i) => {
                      const reminder = formatTemplateReminder(task.reminderBeforeDays);
                      return (
                        <li key={`${g.milestoneId}-${i}`} className="text-sm text-foreground">
                          <span>{task.title}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {formatShortDaysOffset(task.daysOffset)}
                          </span>
                          {reminder && (
                            <span className="ml-2 block text-[11px] text-muted-foreground">{reminder}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </LibraryPreviewChrome>
  );
}
