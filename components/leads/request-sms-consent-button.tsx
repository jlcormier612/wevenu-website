"use client";

/**
 * Manual-lead SMS consent UI.
 *
 * Product/compliance: do NOT send an unsolicited SMS merely to obtain SMS consent.
 * Email solicitation is OPEN pending legal basis (see docs/qa/human-facing-cleanup/STATUS.md).
 * Public inquiry checkbox + START keyword remain the supported opt-in paths.
 */

export function RequestSmsConsentButton({
  hasPhone,
  textingConfigured,
}: {
  leadId: string;
  alreadyRequested: boolean;
  hasPhone?: boolean;
  textingConfigured?: boolean;
}) {
  if (textingConfigured === false) {
    return (
      <div className="space-y-1.5 pt-1">
        <p className="text-xs text-muted-foreground">
          Text messages: Not opted in. Texting isn&apos;t set up for this venue yet, so a permission
          request can&apos;t be sent.
        </p>
      </div>
    );
  }

  if (hasPhone === false) {
    return (
      <div className="space-y-1.5 pt-1">
        <p className="text-xs text-muted-foreground">
          Text messages: Not opted in. Add a phone number first. A phone number alone is never consent.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 pt-1">
      <p className="text-xs font-medium text-heading">Text messages: Not opted in</p>
      <p className="text-xs text-muted-foreground">
        No text permission is on file. Texts can&apos;t be sent until they opt in. Hello to Cheers does
        not send an unsolicited text to ask for permission. Use the public inquiry/tour SMS opt-in
        checkbox when they reach out that way, or wait until they reply{" "}
        <span className="font-medium">START</span> to a message they already receive through a
        permitted channel.
      </p>
    </div>
  );
}
