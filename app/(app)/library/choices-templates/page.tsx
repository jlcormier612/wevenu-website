import type { Metadata } from "next";

import { ChoicesTemplateList } from "@/components/client-choices-templates/choices-template-list";
import { LibraryDependencyNote, LibraryHowItWorks } from "@/components/library/library-guidance";
import { PageHeader } from "@/components/shell/module-placeholder";
import { getTemplates } from "@/lib/client-choices-templates/service";
import { getTemplateApplyClientGroups } from "@/lib/library/template-apply-targets-service";

export const metadata: Metadata = { title: "Choices Templates" };

export default async function ChoicesTemplatesPage() {
  const [templates, clientGroups] = await Promise.all([
    getTemplates(true),
    getTemplateApplyClientGroups(),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Choices Templates"
        description="Reusable client choice forms — menus, bar, linens, rentals, and other post-booking decisions."
      />
      <LibraryHowItWorks>
        Build the questions and options once. Use Template on a client booking to create that event&apos;s client choices from this template.
      </LibraryHowItWorks>
      <LibraryDependencyNote
        detail="When you edit a template, select offerings as choice options first. Customize the customer-facing label if needed. Add a custom option only for one-offs. Applying freezes a snapshot into that event&apos;s client choices."
        action={{ href: "/library/offerings", label: "Manage Offerings" }}
      >
        Built from your Offerings catalog.
      </LibraryDependencyNote>
      <ChoicesTemplateList
        templates={templates}
        clientGroups={clientGroups}
      />
    </div>
  );
}
