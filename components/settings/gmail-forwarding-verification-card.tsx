"use client";

import * as React from "react";

import { Check, Copy, ExternalLink, MailCheck } from "lucide-react";
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

  const panelClass =
    "space-y-4 rounded-[12px] border border-[color:color-mix(in_oklch,var(--htc-botanical)_22%,var(--htc-border-warm,#e6e0d6))] bg-[#EEF1E9] p-5";

  if (verification.display === "expired") {
    return (
      <div
        className={panelClass}
        data-testid="gmail-forwarding-verification"
        data-state="expired"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[color:var(--htc-botanical)]">
            <MailCheck className="h-4 w-4" aria-hidden />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[color:var(--htc-charcoal,#2c2c2c)]">
              Request a new Gmail confirmation
            </p>
            <p className="text-sm leading-relaxed text-[color:var(--htc-charcoal,#2c2c2c)]">
              This confirmation is no longer available. Return to your Gmail forwarding settings to
              request a new confirmation for your Hello to Cheers inquiry email address.
            </p>
          </div>
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
        className={panelClass}
        data-testid="gmail-forwarding-verification"
        data-state="opened"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[color:var(--htc-botanical)]">
            <MailCheck className="h-4 w-4" aria-hidden />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[color:var(--htc-charcoal,#2c2c2c)]">
              Finish your Gmail setup
            </p>
            <p className="text-sm leading-relaxed text-[color:var(--htc-charcoal,#2c2c2c)]">
              After confirming your forwarding address with Google, return to Gmail to create your
              forwarding rules. Then send a test inquiry and check that it appears in your Leads
              workspace.
            </p>
          </div>
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
        <p className="text-xs text-[color:var(--htc-charcoal,#2c2c2c)]/80">
          Once you&apos;ve confirmed your address, follow the steps below to create your forwarding
          rules and send a test inquiry.
        </p>
      </div>
    );
  }

  const linkPrimary = verification.hasLink;
  const codeOnly = !verification.hasLink && Boolean(verification.confirmationCode);

  return (
    <div
      className={panelClass}
      data-testid="gmail-forwarding-verification"
      data-state="pending"
      data-fixture={verification.id.startsWith("fixture-") ? "true" : undefined}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[color:var(--htc-botanical)]">
          <MailCheck className="h-4 w-4" aria-hidden />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[color:var(--htc-charcoal,#2c2c2c)]">
            Finish connecting Gmail
          </p>
          <p className="text-sm leading-relaxed text-[color:var(--htc-charcoal,#2c2c2c)]">
            We&apos;ve received your forwarding confirmation from Google. You&apos;re one step closer
            to receiving your inquiries automatically.
          </p>
        </div>
      </div>

      {linkPrimary ? (
        <>
          <Button
            type="button"
            size="sm"
            className="bg-[color:var(--htc-botanical)] text-white hover:bg-[color:color-mix(in_oklch,var(--htc-botanical)_88%,black)]"
            onClick={openGoogle}
          >
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            Confirm forwarding with Google
          </Button>
          <p className="text-xs text-[color:var(--htc-charcoal,#2c2c2c)]/80">
            You&apos;ll be taken to Google to complete your confirmation.
          </p>
        </>
      ) : null}

      {verification.confirmationCode ? (
        <div className="space-y-2 border-t border-[color:color-mix(in_oklch,var(--htc-botanical)_18%,transparent)] pt-4">
          {linkPrimary ? (
            <p className="text-sm font-medium text-[color:var(--htc-charcoal,#2c2c2c)]">
              Prefer to enter your confirmation code?
            </p>
          ) : (
            <p className="text-sm font-medium text-[color:var(--htc-charcoal,#2c2c2c)]">
              Enter your confirmation code in Gmail
            </p>
          )}
          <p className="text-xs text-[color:var(--htc-charcoal,#2c2c2c)]/80">
            Enter this code in your Gmail forwarding settings.
          </p>
          <CodeBlock code={verification.confirmationCode} copied={copied} onCopy={copyCode} />
        </div>
      ) : null}

      {!codeOnly || verification.confirmationCode ? (
        <p className="text-xs text-[color:var(--htc-charcoal,#2c2c2c)]/80">
          Once you&apos;ve confirmed your address, follow the steps below to create your forwarding
          rules and send a test inquiry.
        </p>
      ) : null}
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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <code className="flex-1 rounded-md border border-border bg-white px-3 py-2.5 font-mono text-sm tabular-nums tracking-wider text-[color:var(--htc-charcoal,#2c2c2c)]">
        {code}
      </code>
      <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onCopy}>
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
