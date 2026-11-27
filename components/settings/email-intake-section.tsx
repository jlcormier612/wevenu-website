"use client";

import * as React from "react";

import { Check, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";

import { connectEmailIntakeAction } from "@/app/(app)/settings/email-intake-actions";
import { SetupGuideLink } from "@/components/help/setup-guide-link";
import { EmailIntakeHealth } from "@/components/settings/email-intake-health";
import { GmailForwardingVerificationCard } from "@/components/settings/gmail-forwarding-verification-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EmailIntakeHealthView } from "@/lib/lead-intake/email-intake-health";
import type { EmailIntakeStatus } from "@/lib/lead-intake/email-status";
import type { GmailVerificationCustomerView } from "@/lib/lead-intake/gmail-forwarding-verification";

const PROVIDERS: { name: string; steps: string[] }[] = [
  {
    name: "The Knot & WeddingWire",
    steps: [
      "Sign in to your WeddingPro account.",
      "Review your inquiry notification settings.",
      "Confirm that inquiry notifications are being delivered to your business email address.",
      "Open one of your recent inquiry emails and identify its sender address and subject line.",
      "Create an automatic forwarding rule in your email account using the Gmail or Outlook instructions.",
      "Test your forwarding rule with a representative inquiry.",
    ],
  },
  {
    name: "Here Comes The Guide",
    steps: [
      "Review the email address associated with your venue listing.",
      "Open a recent inquiry notification and identify its sender and subject line.",
      "Create an automatic forwarding rule using the instructions for your email provider.",
      "If your listing allows additional inquiry recipients, you can also add your unique Hello to Cheers inquiry email address.",
    ],
  },
  {
    name: "Gmail & Google Workspace",
    steps: [
      "Open Gmail on your computer.",
      "Open Settings and select See all settings.",
      "Locate the forwarding settings under Forwarding and POP/IMAP or Forwarding.",
      "Select Add a forwarding address and paste your unique Hello to Cheers inquiry email address.",
      "Follow Google's address-verification prompts.",
      "Once verified, create a filter that matches your inquiry notifications and forwards them to your Hello to Cheers address.",
    ],
  },
  {
    name: "Outlook & Microsoft 365",
    steps: [
      "Open Outlook and enter Settings.",
      "Navigate to Mail and then Rules.",
      "Create a new rule with a descriptive name, such as Wedding Directory Inquiries.",
      "Add conditions that identify your inquiry notifications, using the sender's address or relevant subject line.",
      "Set the rule's action to Forward to and enter your unique Hello to Cheers inquiry email address.",
      "Save your rule and repeat for any additional inquiry sources.",
    ],
  },
  {
    name: "Other inquiry sources",
    steps: [
      "Identify where your inquiry notifications are delivered.",
      "Create an automatic forwarding rule for those notifications.",
      "Use your unique Hello to Cheers inquiry email address as the forwarding destination.",
      "Test the connection.",
      "If the service allows you to specify additional inquiry email recipients, you can also arrange for inquiries to be delivered directly.",
    ],
  },
];

export function EmailIntakeSection({
  status,
  leadEmailAddress,
  intakeHealth = null,
  gmailVerification = null,
}: {
  status: EmailIntakeStatus | null;
  /** null when RESEND_INBOUND_ADDRESS isn't set platform-wide — a genuinely different state from "this venue hasn't connected yet." */
  leadEmailAddress: string | null;
  intakeHealth?: EmailIntakeHealthView | null;
  gmailVerification?: GmailVerificationCustomerView | null;
}) {
  const [connecting, startConnect] = React.useTransition();
  const [copied, setCopied] = React.useState(false);
  const [openProvider, setOpenProvider] = React.useState<string | null>(null);

  const isConnected = !!status?.connectedAt;

  function handleConnect() {
    startConnect(async () => {
      const result = await connectEmailIntakeAction();
      if (!result.ok) toast.error("Could not connect Email Intake.");
    });
  }

  function copyAddress() {
    if (!leadEmailAddress) return;
    navigator.clipboard.writeText(leadEmailAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // RESEND_INBOUND_ADDRESS is a platform-wide deployment setting, not
  // something any venue can configure — there is no customer action that
  // resolves this state, so the correct behavior is to not surface the
  // card at all rather than show a venue an unactionable "not available"
  // message. This env var must be set before launch for the feature
  // (otherwise complete) to appear for any venue.
  if (!leadEmailAddress) return null;

  return (
    <div id="email-intake" className="htc-surface-guidance scroll-mt-20 space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-heading">Email Inquiry Intake</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bring your inquiries together — automatically.
          </p>
        </div>
        {isConnected ? (
          <Badge variant="success">Ready to use</Badge>
        ) : (
          <Badge variant="muted">Not connected</Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Receive inquiries from wedding directories, advertising platforms and other email-based lead sources directly in Hello to Cheers.
      </p>
      <p className="text-sm text-muted-foreground">
        Set up automatic forwarding from your email account or add your unique inquiry email address to supported inquiry sources.
      </p>

      {!isConnected ? (
        <Button type="button" size="sm" onClick={handleConnect} disabled={connecting}>
          {connecting ? "Connecting…" : "Connect Email Intake"}
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your venue&apos;s unique inquiry email address
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted border border-border px-3 py-2 text-xs font-mono text-foreground truncate">
                {leadEmailAddress}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={copyAddress}>
                {copied ? <><Check className="mr-1 h-3.5 w-3.5" />Copied!</> : <><Copy className="mr-1 h-3.5 w-3.5" />Copy</>}
              </Button>
            </div>
          </div>

          {gmailVerification ? (
            <GmailForwardingVerificationCard verification={gmailVerification} />
          ) : null}

          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-foreground">Three simple steps to automatic inquiries</p>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">1. Copy your inquiry email address</span>
                <p className="mt-0.5 text-xs">
                  Use your unique Hello to Cheers address for all your email-based inquiry sources.
                </p>
              </li>
              <li>
                <span className="font-medium text-foreground">2. Set up automatic forwarding</span>
                <p className="mt-0.5 text-xs">
                  Create email rules for incoming inquiries or add your address directly to supported listing services.
                </p>
              </li>
              <li>
                <span className="font-medium text-foreground">3. Send a test inquiry</span>
                <p className="mt-0.5 text-xs">
                  Check your Leads workspace to confirm your inquiries are arriving.
                </p>
              </li>
            </ol>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Setup instructions by provider
            </p>
            {PROVIDERS.map((p) => (
              <div key={p.name} className="rounded-md border border-border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-heading"
                  onClick={() => setOpenProvider((cur) => (cur === p.name ? null : p.name))}
                >
                  {p.name}
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openProvider === p.name ? "rotate-180" : ""}`} />
                </button>
                {openProvider === p.name && (
                  <ol className="space-y-1 border-t border-border px-3 py-2 text-xs text-muted-foreground list-decimal list-inside">
                    {p.steps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                )}
              </div>
            ))}
          </div>

          <SetupGuideLink
            href="/help/how-to-automatically-forward-inquiries-to-hello-to-cheers"
            label="View the complete email inquiry setup guide"
          />
        </div>
      )}
      {intakeHealth ? <EmailIntakeHealth health={intakeHealth} /> : null}
    </div>
  );
}
