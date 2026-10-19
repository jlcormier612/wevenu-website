"use client";

import * as React from "react";

import { Check, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";

import { connectEmailIntakeAction } from "@/app/(app)/settings/email-intake-actions";
import { EmailIntakeHealth } from "@/components/settings/email-intake-health";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EmailIntakeHealthView } from "@/lib/lead-intake/email-intake-health";
import type { EmailIntakeStatus } from "@/lib/lead-intake/email-status";

const PROVIDERS: { name: string; steps: string[] }[] = [
  {
    name: "Here Comes the Guide",
    steps: [
      "Here Comes the Guide emails the venue when someone inquires. Which address receives that mail is set with them. Their site does not give venues a login to change it.",
      "If those messages already arrive in a mailbox you control, forward only those messages to the address above. Do not point the listing at this address unless Here Comes the Guide confirms that for your listing.",
    ],
  },
  {
    name: "WeddingWire",
    steps: [
      "WeddingWire keeps leads in the WeddingPro inbox. The app can forward one lead at a time to another email address. That is manual. It is not an automatic rule, and US WeddingPro help does not show an extra-recipient setting.",
      "If new-lead emails already arrive in your inbox, forward only those messages to the address above.",
    ],
  },
  {
    name: "The Knot",
    steps: [
      "The Knot sends vendor email from partner.theknot.com and member.theknot.com. Leads are read in WeddingPro. No setting was found that adds a second address for new leads.",
      "If inquiry emails already arrive in your inbox, forward only those messages to the address above. Do not add this address inside The Knot unless The Knot shows you that control.",
    ],
  },
  {
    name: "Zola",
    steps: [
      "Zola documents inquiries inside the vendor dashboard. A separate inquiry email you can forward has not been confirmed.",
      "Do not create a Zola forwarding rule until a real Zola inquiry email is in a mailbox you control.",
    ],
  },
  {
    name: "Gmail",
    steps: [
      "Settings → Filters and Blocked Addresses → Create a new filter.",
      "Match only the inquiry sender or subject you already receive, then choose Forward to the address above. Leave the rest of your inbox alone.",
    ],
  },
  {
    name: "Outlook",
    steps: [
      "Settings → Mail → Rules → Add a new rule.",
      "Condition: only the inquiry sender or subject. Action: forward to the address above. Do not forward all incoming mail.",
    ],
  },
];

export function EmailIntakeSection({
  status, leadEmailAddress, intakeHealth = null,
}: {
  status: EmailIntakeStatus | null;
  /** null when RESEND_INBOUND_ADDRESS isn't set platform-wide — a genuinely different state from "this venue hasn't connected yet." */
  leadEmailAddress: string | null;
  intakeHealth?: EmailIntakeHealthView | null;
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
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-heading">Email intake</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect an inquiry email source so incoming inquiries can be captured as Leads.
          </p>
        </div>
        {isConnected ? (
          <Badge variant="success">Connected</Badge>
        ) : (
          <Badge variant="muted">Not connected</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        After you connect, copy the address and send inquiry emails to it. Hello to Cheers creates
        a Lead from the message. The Knot, WeddingWire, Zola, and Here Comes the Guide are not
        connected integrations. A lead is labeled with one of those names only after that
        provider&apos;s message has been verified. Until then it is stored as email intake.
      </p>

      {!isConnected ? (
        <Button type="button" size="sm" onClick={handleConnect} disabled={connecting}>
          {connecting ? "Connecting…" : "Connect Email Intake"}
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted border border-border px-3 py-2 text-xs font-mono text-foreground truncate">
              {leadEmailAddress}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={copyAddress}>
              {copied ? <><Check className="mr-1 h-3.5 w-3.5" />Copied!</> : <><Copy className="mr-1 h-3.5 w-3.5" />Copy</>}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Use a mailbox filter or forward one inquiry at a time. Send only inquiry mail — not
            your whole inbox. Open Leads to confirm it arrived. If the marketplace cannot be
            verified from the message, the lead still appears as email intake.
          </p>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Forwarding instructions</p>
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
            <p className="text-[10px] text-muted-foreground italic">
              Mailbox steps are what you can do today. A marketplace name in this list is not a connection.
            </p>
          </div>
        </div>
      )}
      {intakeHealth ? <EmailIntakeHealth health={intakeHealth} /> : null}
    </div>
  );
}
