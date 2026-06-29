import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { PlaybooksSection } from "@/components/settings/playbooks-section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTemplates } from "@/lib/playbooks/service";

export const metadata: Metadata = { title: "Playbooks" };

export default async function PlaybooksLibraryPage() {
  const templates = await getTemplates();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Playbooks"
        description="Reusable event task templates. Apply a playbook to any event to generate tasks, assign ownership, and schedule reminders automatically."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Playbooks</CardTitle>
          <CardDescription>
            Each playbook is a template of tasks with relative due dates and auto-completion rules.
            Click a playbook to edit its task definitions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlaybooksSection initialTemplates={templates} />
        </CardContent>
      </Card>
    </div>
  );
}
