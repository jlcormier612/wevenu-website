"use client";

import * as React from "react";

import { Check, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";

import { connectEmailIntakeAction } from "@/app/(app)/settings/email-intake-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EmailIntakeStatus } from "@/lib/lead-intake/email-status";

const PROVIDERS: { name: string; steps: string[] }[] = [
  { name: "The Knot", steps: ["Storefront → Settings → Notifications", "Add your forwarding address as an additional inquiry notification recipient"] },
  { name: "WeddingWire", steps: ["Storefront → Settings → Lead Notifications", "Add your forwarding address alongside your own email"] },
  { name: "Zola", steps: ["Vendor dashboard → Settings → Notifications", "Add your forwarding address as a CC/additional recipient"] },
  { name: "Gmail", steps: ["Settings → Filters and Blocked Addresses → Create a new filter", "Match inquiry emails, choose \"Forward to\" your forwarding address"] },
  { name: "Outlook", steps: ["Settings → Mail → Rules → Add a new rule", "Condition: subject/sender matches your inquiry notifications", "Action: forward to your forwarding address"] },
];

export function EmailIntakeSection({
  status, leadEmailAddress,
}: {
  status: EmailIntakeStatus | null;
  /** null when RESEND_INBOUND_ADDRESS isn't set platform-wide — a genuinely different state from "this venue hasn't connected yet." */
  leadEmailAddress: string | null;
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
        Forward inquiry notifications from The Knot, WeddingWire, or anywhere else that emails you
        a new inquiry — each one becomes a Lead automatically.
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
            Forward a test inquiry to this address to confirm it&apos;s working. You&apos;ll see it
            in Leads once it arrives.
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
            <p className="text-[10px] text-muted-foreground italic">General steps — exact menus vary by provider and change over time.</p>
          </div>
        </div>
      )}
    </div>
  );
}
