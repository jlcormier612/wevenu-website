"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { requestSmsConsentAction } from "@/app/(app)/leads/[id]/actions";
import { Button } from "@/components/ui/button";

export function RequestSmsConsentButton({
  leadId,
  alreadyRequested,
}: {
  leadId: string;
  alreadyRequested: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [justSent, setJustSent] = React.useState(false);

  return (
    <div className="space-y-1.5 pt-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await requestSmsConsentAction(leadId);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            setJustSent(true);
            router.refresh();
          });
        }}
      >
        {pending
          ? "Sending…"
          : alreadyRequested || justSent
            ? "Resend permission request"
            : "Request text permission"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Sends a text asking them to reply START. They are not opted in until they reply.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {justSent && !error && (
        <p className="text-xs text-emerald-700">Permission request sent. Waiting for them to reply START.</p>
      )}
    </div>
  );
}
