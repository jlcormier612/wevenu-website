"use client";

/**
 * Blocks in-place edit of HTC contract starters — Customize creates a venue-owned copy.
 */

import { duplicateTemplateAction } from "@/app/(app)/contracts/actions";
import { StarterOwnershipBanner } from "@/components/library/starter-ownership-banner";

export function ContractStarterEditGate({
  templateId,
  templateName,
}: {
  templateId: string;
  templateName: string;
}) {
  return (
    <StarterOwnershipBanner
      templateName={templateName}
      itemNoun="agreement content"
      customizeHref={(id) => `/contracts/templates/${id}/edit`}
      onCustomize={async () => {
        const suggested = templateName.replace(/\s*\(Starter\)\s*$/i, "").trim() || templateName;
        const result = await duplicateTemplateAction(
          templateId,
          `${suggested} — ${new Date().getFullYear()}`,
        );
        if (result.ok && result.templateId) {
          return { ok: true as const, templateId: result.templateId };
        }
        return { ok: false as const, message: result.message };
      }}
    />
  );
}
