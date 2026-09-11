import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TemplatePreview } from "@/components/communication/template-preview";
import { LibraryPreviewChrome } from "@/components/library/library-preview-chrome";
import { getTemplate, getTemplateAttachments } from "@/lib/message-templates/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template ? `Preview — ${template.name}` : "Preview message" };
}

export default async function MessageTemplatePreviewPage({ params }: Props) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();
  const attachments = await getTemplateAttachments(template.id);

  return (
    <LibraryPreviewChrome
      caption="Recipient-facing preview with sample merge values. Preview does not send anything."
      editHref={`/communication/templates/${template.id}/edit`}
      libraryHref="/communication/templates"
      contentMaxWidthClassName="max-w-3xl"
    >
      <div className="space-y-3">
        <h1 className="font-heading text-xl font-medium text-heading">{template.name}</h1>
        <TemplatePreview
          input={{
            name: template.name,
            category: template.category,
            emailSubject: template.emailSubject ?? "",
            emailBody: template.emailBody ?? "",
            smsBody: template.smsBody ?? "",
          }}
          attachments={attachments}
        />
      </div>
    </LibraryPreviewChrome>
  );
}
