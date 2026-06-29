import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { PlaybooksSection } from "@/components/settings/playbooks-section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTemplates } from "@/lib/playbooks/service";

export const metadata: Metadata = { title: "Task Playbooks" };

export default async function PlaybooksLibraryPage() {
  const templates = await getTemplates();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Task Playbooks"
        description="Build the workflows your team follows so nothing gets missed. Each playbook generates tasks, reminders, and automations for every stage of an event."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Playbooks</CardTitle>
          <CardDescription>
            Each playbook is a reusable event workflow — tasks with relative due dates, ownership assignments,
            and auto-completion rules. Apply one to any event and your team is immediately on track.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlaybooksSection initialTemplates={templates} />
        </CardContent>
      </Card>
    </div>
  );
}
