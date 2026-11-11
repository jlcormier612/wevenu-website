"use client";

/**
 * Manual-lead SMS consent UI.
 *
 * Do NOT send an unsolicited SMS to obtain SMS consent.
 * Supported request channel: email → public token page → affirmative opt-in.
 * Clicking this CTA never grants opted_in.
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
      <p className="text-xs text-muted-foreground pt-1">
        Texting isn&apos;t set up for this venue yet, so a permission request can&apos;t be sent.
      </p>
    );
  }

  if (hasPhone === false) {
    return (
      <p className="text-xs text-muted-foreground pt-1">
        Add a phone number first. A phone number alone is never consent.
      </p>
    );
  }

  if (hasEmail === false) {
    return (
      <p className="text-xs text-muted-foreground pt-1">
        Add an email address to request text permission. Hello to Cheers does not send an
        unsolicited text to ask for permission.
      </p>
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
      {alreadyRequested ? (
        <p className="text-xs text-muted-foreground">
          A permission request was already emailed — you can send another if needed.
        </p>
      ) : null}
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={sendEmailRequest}>
        {pending ? "Sending…" : "Request text permission"}
      </Button>
      <p className="text-xs text-muted-foreground">
        We&apos;ll email them a link to opt in. Opening the email is not consent — they must
        actively confirm. Hello to Cheers does not send an unsolicited text to ask for permission.
      </p>
    </div>
  );
}
