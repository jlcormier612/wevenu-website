"use client";

import * as React from "react";

import Link from "next/link";

import { Check, ChevronDown, Copy, ExternalLink } from "lucide-react";

import { EmailIntakeSection } from "@/components/settings/email-intake-section";
import { InquiryFormConfigSection } from "@/components/settings/inquiry-form-config-section";
import { Button } from "@/components/ui/button";
import type { EmailIntakeStatus } from "@/lib/lead-intake/email-status";
import type { InquiryFormSettings } from "@/lib/inquiry-form/types";

const WEBSITE_BUILDER_STEPS: { name: string; steps: string[] }[] = [
  { name: "Squarespace", steps: ["Edit the page → click the + where you want the form", "Choose Code → paste the embed code → Save"] },
  { name: "Wix", steps: ["Edit the site → Add → Embed → Custom Embed", "Paste the embed code → Publish"] },
  { name: "WordPress", steps: ["Edit the page → add a Custom HTML block", "Paste the embed code → Update / Publish"] },
];

export function WebsiteFormsSection({
  embedKey,
  appUrl,
  leadEmailAddress,
  emailIntakeStatus,
  inquiryFormSettings = null,
}: {
  embedKey: string;
  appUrl: string;
  /** null when RESEND_INBOUND_ADDRESS isn't configured platform-wide. */
  leadEmailAddress: string | null;
  emailIntakeStatus: EmailIntakeStatus | null;
  inquiryFormSettings?: InquiryFormSettings | null;
}) {
  const formUrl = `${appUrl}/form/${embedKey}`;
  const iframeCode = `<iframe\n  src="${formUrl}"\n  width="100%"\n  height="700"\n  frameborder="0"\n  title="Venue Inquiry Form"\n></iframe>`;

  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const [copiedEmbed, setCopiedEmbed] = React.useState(false);
  const [howToOpen, setHowToOpen] = React.useState(false);
  const [openBuilder, setOpenBuilder] = React.useState<string | null>(null);

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

      {inquiryFormSettings && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-heading">Inquiry form fields</p>
            <p className="text-xs text-muted-foreground">Control which fields appear on your public inquiry form and how preferred event dates work.</p>
          </div>
          <InquiryFormConfigSection
            initialEventDateMode={inquiryFormSettings.inquiryEventDateMode}
            initialFields={inquiryFormSettings.inquiryFormFields}
            initialQuestions={inquiryFormSettings.customQuestions}
          />
        </div>
      )}

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

          <div className="rounded-md border border-border">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-heading"
              onClick={() => setHowToOpen((cur) => !cur)}
            >
              How to add this to your website
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${howToOpen ? "rotate-180" : ""}`} />
            </button>
            {howToOpen && (
              <div className="space-y-3 border-t border-border px-3 py-3">
                <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside">
                  <li>Copy the embed code above.</li>
                  <li>Go to the page editor on your website where you want the form to appear.</li>
                  <li>Add an Embed, Custom HTML, or Code block, depending on your website platform.</li>
                  <li>Paste the code into that block, then publish or save the page.</li>
                </ol>

                <div className="space-y-1.5">
                  {WEBSITE_BUILDER_STEPS.map((b) => (
                    <div key={b.name} className="rounded-md border border-border">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-medium text-heading"
                        onClick={() => setOpenBuilder((cur) => (cur === b.name ? null : b.name))}
                      >
                        {b.name}
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openBuilder === b.name ? "rotate-180" : ""}`} />
                      </button>
                      {openBuilder === b.name && (
                        <ol className="space-y-1 border-t border-border px-3 py-2 text-xs text-muted-foreground list-decimal list-inside">
                          {b.steps.map((step) => <li key={step}>{step}</li>)}
                        </ol>
                      )}
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground italic">
                  Not sure where to paste this? Send this code to whoever manages your website.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <EmailIntakeSection status={emailIntakeStatus} leadEmailAddress={leadEmailAddress} />

      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-sm font-medium text-heading">More lead sources</p>
        <ul className="space-y-1.5 text-xs">
          <li>
            <span className="text-muted-foreground">Facebook / Instagram Lead Ads — </span>
            <a href="#facebook" className="text-primary hover:underline">connect it above</a>
          </li>
          <li>
            <Link href="/library/qr-campaigns" className="text-primary hover:underline">QR code campaigns</Link>
            <span className="text-muted-foreground"> — bridal shows, brochures, front-gate signs</span>
          </li>
        </ul>
        <p className="text-xs text-muted-foreground italic pt-1">
          All sources flow into this same lead pipeline — every opportunity begins in Hello to Cheers.
        </p>
      </div>
    </div>
  );
}
