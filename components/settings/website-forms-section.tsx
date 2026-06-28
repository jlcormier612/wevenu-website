"use client";

import * as React from "react";

import { Check, Copy, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";

export function WebsiteFormsSection({
  embedKey,
  appUrl,
}: {
  embedKey: string;
  appUrl: string;
}) {
  const formUrl = `${appUrl}/form/${embedKey}`;
  const iframeCode = `<iframe\n  src="${formUrl}"\n  width="100%"\n  height="700"\n  frameborder="0"\n  title="Venue Inquiry Form"\n></iframe>`;

  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const [copiedEmbed, setCopiedEmbed] = React.useState(false);

  function copy(text: string, which: "url" | "embed") {
    navigator.clipboard.writeText(text);
    if (which === "url") { setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000); }
    else { setCopiedEmbed(true); setTimeout(() => setCopiedEmbed(false), 2000); }
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

      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-sm font-medium text-heading">Future integrations</p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {["The Knot", "WeddingWire", "Facebook / Instagram Lead Ads", "QR code capture", "Email-to-lead parsing"].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground italic pt-1">
          All sources will flow into this same lead pipeline — every opportunity begins in Wevenu.
        </p>
      </div>
    </div>
  );
}
