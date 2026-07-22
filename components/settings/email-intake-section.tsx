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

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

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
  const hasReceivedAnything = !!status?.lastEmailReceivedAt;

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

  if (!leadEmailAddress) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-1">
        <p className="text-sm font-medium text-heading">Email intake</p>
        <p className="text-xs text-muted-foreground italic">Not available in this environment yet — inbound email isn&apos;t configured platform-wide.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-heading">Email intake</p>
        {isConnected ? (
          hasReceivedAnything
            ? <Badge variant="success">Connected</Badge>
            : <Badge variant="warning">Awaiting first email</Badge>
        ) : (
          <Badge variant="muted">Not connected</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Forward inquiry notifications from The Knot, WeddingWire, or anywhere else that emails you a new inquiry — each one becomes a lead automatically.
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

          <div className="grid grid-cols-3 gap-3 rounded-md border border-border p-3 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last email</p>
              <p className="text-sm font-medium text-heading">{timeAgo(status.lastEmailReceivedAt)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last lead</p>
              <p className="text-sm font-medium text-heading">{timeAgo(status.lastLeadImportedAt)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Confidence</p>
              <p className="text-sm font-medium text-heading">{status.confidencePercent != null ? `${status.confidencePercent}%` : "—"}</p>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Each lead shows how confident the extraction was. When it&apos;s low, the lead is still created right away, but automated follow-ups wait until you&apos;ve confirmed the details.
      </p>
    </div>
  );
}
