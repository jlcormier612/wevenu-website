"use client";

/**
 * Manual-lead SMS consent UI.
 *
 * Do NOT send an unsolicited SMS to obtain SMS consent.
 * When texting is configured and email exists: Request permission by email
 * (consent recorded only after affirmative opt-in on the token page).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { requestSmsConsentEmailAction } from "@/app/(app)/leads/[id]/actions";
import { Button } from "@/components/ui/button";

export function RequestSmsConsentButton({
  leadId,
  alreadyRequested,
  hasPhone,
  hasEmail,
  textingConfigured,
}: {
  leadId: string;
  alreadyRequested: boolean;
  hasPhone?: boolean;
  hasEmail?: boolean;
  textingConfigured?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

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

  if (hasEmail === false) {
    return (
      <div className="space-y-1.5 pt-1">
        <p className="text-xs font-medium text-heading">Text messages: Not opted in</p>
        <p className="text-xs text-muted-foreground">
          No text permission is on file. Texts can&apos;t be sent until they opt in. Add an email
          address to request permission by email, or wait until they reply{" "}
          <span className="font-medium">START</span> to a message they already receive through a
          permitted channel. Hello to Cheers does not send an unsolicited text to ask for permission.
        </p>
      </div>
    );
  }

  function sendEmailRequest() {
    startTransition(async () => {
      const result = await requestSmsConsentEmailAction(leadId);
      if (!result.ok) {
        toast.error(result.message ?? "Could not send permission request.");
        return;
      }
      toast.success("Permission request emailed. Texts stay blocked until they opt in.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 pt-1">
      <p className="text-xs font-medium text-heading">Text messages: Not opted in</p>
      <p className="text-xs text-muted-foreground">
        No text permission is on file. Texts can&apos;t be sent until they opt in.
        {alreadyRequested
          ? " A permission request was already sent — you can send another if needed."
          : null}
      </p>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={sendEmailRequest}>
        {pending ? "Sending…" : "Request permission by email"}
      </Button>
      <p className="text-xs text-muted-foreground">
        They must open the email and actively confirm. Opening the email alone is not consent.
        Hello to Cheers does not send an unsolicited text to ask for permission.
      </p>
    </div>
  );
}
