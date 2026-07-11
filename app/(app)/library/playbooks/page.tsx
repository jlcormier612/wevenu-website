import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { PlaybooksSection } from "@/components/settings/playbooks-section";
import { getTemplatesForLibrary } from "@/lib/playbooks/service";

export const metadata: Metadata = { title: "Planning Templates" };

export default async function PlaybooksLibraryPage() {
  const templates = await getTemplatesForLibrary();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Planning Templates"
        description="The planning checklists you've refined over the years — organized by event type, ready to open and apply to any event."
      />
      <PlaybooksSection initialTemplates={templates} />
    </div>
  );
}
