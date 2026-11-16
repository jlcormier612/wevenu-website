import type { Metadata } from "next";

import { MessageTemplateList } from "@/components/communication/message-template-list";
import { MessageTemplateStarterPicker } from "@/components/communication/message-template-starter-picker";
import { AddHelloToCheersStarters } from "@/components/communication/add-hello-to-cheers-starters";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { SetupHubReturnLink } from "@/components/setup-hub/phase-b1/setup-hub-return-link";
import { LibraryHowItWorks } from "@/components/library/library-guidance";
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
  const active = templates.filter((t) => !t.isArchived);

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      <SetupHubReturnLink href="/setup-hub/make-htc-yours/communications" label="Back to your communications" />
      <CollectionBackLink href="/library" label="Templates" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Message Templates"
          description="Prepare reusable emails and text messages for inquiries, bookings, and planning."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <MessageTemplateStarterPicker existingTemplates={active} />
              <MessageTemplateStarterPicker existingTemplates={active} variant="import" />
              <AddHelloToCheersStarters
                missingMasters={missingMasters.map((m) => ({ key: m.key, name: m.name }))}
                presentKeys={[...presentKeys].filter((k): k is string => Boolean(k))}
              />
            </div>
          }
        />
      </div>
      <LibraryHowItWorks tone="calm">
        Review a starter message or customize it to create your own editable copy. Nothing is sent
        until you choose to send it.
      </LibraryHowItWorks>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No templates yet</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Create a reusable email or text message, or bring in one you already send.
          </p>
          <div className="flex items-center gap-2">
            <MessageTemplateStarterPicker existingTemplates={[]} />
            <MessageTemplateStarterPicker existingTemplates={[]} variant="import" />
          </div>
        </div>
      ) : (
        <MessageTemplateList initialTemplates={templates} />
      )}
    </div>
  );
}
