import type { Metadata } from "next";

import { MessageTemplateList } from "@/components/communication/message-template-list";
import { MessageTemplateStarterPicker } from "@/components/communication/message-template-starter-picker";
import { AddHelloToCheersStarters } from "@/components/communication/add-hello-to-cheers-starters";
import { PageHeader } from "@/components/shell/module-placeholder";
import { getTemplates } from "@/lib/message-templates/service";
import { ensureStarterMessageTemplatesForCurrentVenue } from "@/lib/message-templates/provision";
import { STARTER_MESSAGE_MASTERS } from "@/lib/message-templates/starters";

export const metadata: Metadata = { title: "Message Templates" };

export default async function MessageTemplatesPage() {
  await ensureStarterMessageTemplatesForCurrentVenue();
  const templates = await getTemplates(true);
  const presentKeys = new Set(templates.map((t) => t.sourceMasterKey).filter(Boolean));
  const missingMasters = STARTER_MESSAGE_MASTERS.filter((m) => !presentKeys.has(m.key));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Message Templates"
        description="Reusable email and text messages for couples — including Hello to Cheers starters you can edit to sound like your venue."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AddHelloToCheersStarters missingMasters={missingMasters.map((m) => ({ key: m.key, name: m.name }))} />
            <MessageTemplateStarterPicker existingTemplates={templates.filter((t) => !t.isArchived)} variant="import" />
            <MessageTemplateStarterPicker existingTemplates={templates.filter((t) => !t.isArchived)} />
          </div>
        }
      />

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No templates yet</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Create a reusable email or text message, or bring in one you already send.
          </p>
          <div className="flex items-center gap-2">
            <MessageTemplateStarterPicker existingTemplates={[]} variant="import" />
            <MessageTemplateStarterPicker existingTemplates={[]} />
          </div>
        </div>
      ) : (
        <MessageTemplateList initialTemplates={templates} />
      )}
    </div>
  );
}
