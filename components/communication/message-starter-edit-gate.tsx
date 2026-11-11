"use client";

/**
 * Blocks in-place edit of HTC message starters — Customize creates a venue-owned copy.
 */

import { duplicateTemplateAction } from "@/app/(app)/communication/templates/actions";
import { StarterOwnershipBanner } from "@/components/library/starter-ownership-banner";

export function MessageStarterEditGate({
  templateId,
  templateName,
}: {
  templateId: string;
  templateName: string;
}) {
  return (
    <StarterOwnershipBanner
      templateName={templateName}
      itemNoun="content"
      customizeHref={(id) => `/communication/templates/${id}/edit`}
      onCustomize={async () => {
        const suggested = templateName.replace(/\s*\(Starter\)\s*$/i, "").trim() || templateName;
        const result = await duplicateTemplateAction(
          templateId,
          `${suggested} — ${new Date().getFullYear()}`,
        );
        if (result.ok && result.templateId) {
          return { ok: true as const, templateId: result.templateId };
        }
        return { ok: false as const, message: (result as { message?: string }).message };
      }}
    />
  );
}
