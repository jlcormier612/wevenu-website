import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PlaybookTaskEditor } from "@/components/playbooks/playbook-task-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTemplate, getTemplateTasks } from "@/lib/playbooks/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template ? `${template.name} — Playbooks` : "Playbook Editor" };
}

export default async function PlaybookEditorPage({ params }: Props) {
  const { id } = await params;
  const [template, tasks] = await Promise.all([getTemplate(id), getTemplateTasks(id)]);
  if (!template) notFound();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="space-y-1">
        <Link href="/library/playbooks" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Task Playbooks
        </Link>
        <h1 className="font-heading text-2xl font-medium text-heading">{template.name}</h1>
        <p className="text-sm text-muted-foreground">
          {template.eventType ? `${template.eventType.replace(/_/g, " ")} template` : "All event types"} · {tasks.length} task{tasks.length !== 1 ? "s" : ""}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task Definitions</CardTitle>
          <CardDescription>
            Tasks are generated with real due dates when this playbook is applied to an event.
            Negative offset = before event date. Positive = after event date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlaybookTaskEditor templateId={id} initialTasks={tasks} allTemplateTasks={tasks} />
        </CardContent>
      </Card>
    </div>
  );
}
