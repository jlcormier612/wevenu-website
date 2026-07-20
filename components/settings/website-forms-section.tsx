"use client";

import * as React from "react";

import { Check, Copy, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";

export function WebsiteFormsSection({
  embedKey,
  appUrl,
  leadEmailAddress,
}: {
  embedKey: string;
  appUrl: string;
  /** null when RESEND_INBOUND_ADDRESS isn't configured — Email Intake is inert until it is. */
  leadEmailAddress: string | null;
}) {
  const formUrl = `${appUrl}/form/${embedKey}`;
  const iframeCode = `<iframe\n  src="${formUrl}"\n  width="100%"\n  height="700"\n  frameborder="0"\n  title="Venue Inquiry Form"\n></iframe>`;

  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const [copiedEmbed, setCopiedEmbed] = React.useState(false);
  const [copiedEmail, setCopiedEmail] = React.useState(false);

  function copy(text: string, which: "url" | "embed" | "email") {
    navigator.clipboard.writeText(text);
    if (which === "url") { setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000); }
    else if (which === "embed") { setCopiedEmbed(true); setTimeout(() => setCopiedEmbed(false), 2000); }
    else { setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 2000); }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-heading">Direct link</p>
          <p className="text-xs text-muted-foreground">Share this URL directly — email signatures, QR codes, social media.</p>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md bg-muted border border-border px-3 py-2 text-xs font-mono text-foreground truncate">
            {formUrl}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={() => copy(formUrl, "url")}>
            {copiedUrl ? <><Check className="mr-1 h-3.5 w-3.5" />Copied!</> : <><Copy className="mr-1 h-3.5 w-3.5" />Copy</>}
          </Button>
          <Button type="button" variant="outline" size="sm" render={<a href={formUrl} target="_blank" rel="noopener noreferrer" />}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-heading">Website embed</p>
          <p className="text-xs text-muted-foreground">Paste this snippet into your website HTML to embed the form inline.</p>
        </div>
        <div className="space-y-2">
          <pre className="rounded-md bg-muted border border-border px-3 py-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre">
            {iframeCode}
          </pre>
          <Button type="button" variant="outline" size="sm" onClick={() => copy(iframeCode, "embed")}>
            {copiedEmbed ? <><Check className="mr-1 h-3.5 w-3.5" />Copied!</> : <><Copy className="mr-1 h-3.5 w-3.5" />Copy embed code</>}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-heading">Email intake</p>
          <p className="text-xs text-muted-foreground">
            Forward inquiry notifications from The Knot, WeddingWire, or anywhere else that emails you a new inquiry — each one becomes a lead automatically.
          </p>
        </div>
        {leadEmailAddress ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted border border-border px-3 py-2 text-xs font-mono text-foreground truncate">
              {leadEmailAddress}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={() => copy(leadEmailAddress, "email")}>
              {copiedEmail ? <><Check className="mr-1 h-3.5 w-3.5" />Copied!</> : <><Copy className="mr-1 h-3.5 w-3.5" />Copy</>}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Not set up yet — contact support to enable email intake for your venue.</p>
        )}
        <p className="text-xs text-muted-foreground">
          Each lead shows how confident the extraction was. When it's low, the lead is still created right away, but automated follow-ups wait until you've confirmed the details.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-sm font-medium text-heading">Future integrations</p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {["Facebook / Instagram Lead Ads", "QR code capture"].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground italic pt-1">
          All sources flow into this same lead pipeline — every opportunity begins in Hello to Cheers.
        </p>
      </div>
    </div>
  );
}
