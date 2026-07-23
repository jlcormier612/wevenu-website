"use client";

/**
 * Message Template preview mode — bug-report follow-up, 2026-07-22:
 * "when you create a message template from scratch, you need to be able to
 * view it, not just edit it. they'll want to preview it before sending."
 *
 * Renders the template's live (possibly unsaved) content the way it will
 * actually read once sent — merge tokens replaced with realistic sample
 * values (lib/message-templates/preview.ts), line breaks preserved, Email
 * and SMS shown the way each channel actually looks rather than as plain
 * form fields.
 */
import { FileText, Link2, Mail, MessageSquare } from "lucide-react";

import { substituteSampleMergeFields } from "@/lib/message-templates/preview";
import type { MessageTemplateAttachment, MessageTemplateInput } from "@/lib/message-templates/types";

export function TemplatePreview({
  input, attachments,
}: {
  input: MessageTemplateInput;
  attachments: MessageTemplateAttachment[];
}) {
  const hasEmail = !!input.emailBody.trim();
  const hasSms = !!input.smsBody.trim();

  if (!hasEmail && !hasSms) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nothing to preview yet — write an Email or SMS body first.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Merge fields below are shown with sample values (e.g. &quot;{substituteSampleMergeFields("{{client_name}}")}&quot;) so you can see roughly how this will read — the real message will use each couple&apos;s actual details.
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        {hasEmail && (
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email preview</p>
            </div>
            <div className="space-y-3 bg-background p-4">
              <div className="space-y-1 border-b border-border/60 pb-3 text-xs text-muted-foreground">
                <p><span className="font-medium text-foreground">From:</span> {substituteSampleMergeFields("{{venue_name}}")}</p>
                <p><span className="font-medium text-foreground">To:</span> {substituteSampleMergeFields("{{client_name}}")}</p>
                {input.emailSubject.trim() && (
                  <p className="pt-1 text-sm font-semibold text-heading">
                    {substituteSampleMergeFields(input.emailSubject)}
                  </p>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {substituteSampleMergeFields(input.emailBody)}
              </p>
            </div>
          </div>
        )}

        {hasSms && (
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SMS preview</p>
            </div>
            <div className="flex justify-end bg-background p-4">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
                {substituteSampleMergeFields(input.smsBody)}
              </p>
            </div>
          </div>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attached</p>
          <div className="flex flex-wrap gap-2">
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-foreground">
                {a.documentId ? <FileText className="h-3.5 w-3.5 text-muted-foreground" /> : <Link2 className="h-3.5 w-3.5 text-muted-foreground" />}
                {a.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
