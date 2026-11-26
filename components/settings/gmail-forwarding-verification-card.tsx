"use client";

import * as React from "react";

import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import {
  acknowledgeGmailForwardingVerificationAction,
  dismissGmailForwardingVerificationAction,
} from "@/app/(app)/settings/gmail-forwarding-verification-actions";
import { Button } from "@/components/ui/button";
import type { GmailVerificationCustomerView } from "@/lib/lead-intake/gmail-forwarding-verification";

export function GmailForwardingVerificationCard({
  verification,
}: {
  verification: GmailVerificationCustomerView;
}) {
  const [busy, startBusy] = React.useTransition();
  const [copied, setCopied] = React.useState(false);

  function copyCode() {
    if (!verification.confirmationCode) return;
    navigator.clipboard.writeText(verification.confirmationCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openGoogle() {
    toast.message("Opening Google’s confirmation…");
    window.open(
      `/api/settings/gmail-forwarding-verification/${verification.id}/open`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  if (verification.display === "expired") {
    return (
      <div
        className="space-y-3 rounded-lg border border-warning/30 bg-warning/5 p-4"
        data-testid="gmail-forwarding-verification"
        data-state="expired"
      >
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Request a new Gmail confirmation</p>
          <p className="text-sm text-muted-foreground">
            This confirmation is no longer available. Return to your Gmail forwarding settings to request a new confirmation for your Hello to Cheers inquiry email address.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() =>
            startBusy(async () => {
              await dismissGmailForwardingVerificationAction(verification.id);
            })
          }
        >
          Dismiss
        </Button>
      </div>
    );
  }

  if (verification.display === "opened") {
    return (
      <div
        className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"
        data-testid="gmail-forwarding-verification"
        data-state="opened"
      >
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Finish your Gmail setup</p>
          <p className="text-sm text-muted-foreground">
            After confirming your forwarding address with Google, return to Gmail to create your forwarding rules. Then send a test inquiry and check that it appears in your Leads workspace.
          </p>
        </div>
        {verification.hasLink ? (
          <Button type="button" size="sm" variant="outline" onClick={openGoogle}>
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            Confirm forwarding with Google
          </Button>
        ) : null}
        {verification.confirmationCode ? (
          <CodeBlock code={verification.confirmationCode} copied={copied} onCopy={copyCode} />
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() =>
            startBusy(async () => {
              await acknowledgeGmailForwardingVerificationAction(verification.id);
            })
          }
        >
          I&apos;ve finished confirming in Gmail
        </Button>
        <p className="text-xs text-muted-foreground">
          Once you&apos;ve confirmed your address, follow the steps below to create your forwarding rules and send a test inquiry.
        </p>
      </div>
    );
  }

  // pending
  const linkPrimary = verification.hasLink;
  const codeOnly = !verification.hasLink && Boolean(verification.confirmationCode);

  return (
    <div
      className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"
      data-testid="gmail-forwarding-verification"
      data-state="pending"
      data-fixture={verification.id.startsWith("fixture-") ? "true" : undefined}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {codeOnly ? "Finish connecting Gmail" : "Finish connecting Gmail"}
        </p>
        <p className="text-sm text-muted-foreground">
          We&apos;ve received your forwarding confirmation from Google. You&apos;re one step closer to receiving your inquiries automatically.
        </p>
      </div>

      {linkPrimary ? (
        <>
          <Button type="button" size="sm" onClick={openGoogle}>
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            Confirm forwarding with Google
          </Button>
          <p className="text-xs text-muted-foreground">You&apos;ll be taken to Google to complete your confirmation.</p>
        </>
      ) : null}

      {verification.confirmationCode ? (
        <div className="space-y-2">
          {linkPrimary ? (
            <p className="text-sm font-medium text-foreground">Prefer to enter your confirmation code?</p>
          ) : (
            <p className="text-sm font-medium text-foreground">Enter your confirmation code in Gmail</p>
          )}
          <p className="text-xs text-muted-foreground">Enter this code in your Gmail forwarding settings.</p>
          <CodeBlock code={verification.confirmationCode} copied={copied} onCopy={copyCode} />
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Once you&apos;ve confirmed your address, follow the steps below to create your forwarding rules and send a test inquiry.
      </p>
    </div>
  );
}

function CodeBlock({
  code,
  copied,
  onCopy,
}: {
  code: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm tracking-wider text-foreground">
        {code}
      </code>
      <Button type="button" variant="outline" size="sm" onClick={onCopy}>
        {copied ? (
          <>
            <Check className="mr-1 h-3.5 w-3.5" />
            Copied
          </>
        ) : (
          <>
            <Copy className="mr-1 h-3.5 w-3.5" />
            Copy code
          </>
        )}
      </Button>
    </div>
  );
}
