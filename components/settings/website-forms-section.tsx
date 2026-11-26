"use client";

import * as React from "react";

import { Check, ChevronDown, Copy, ExternalLink, Eye } from "lucide-react";

import { InquiryForm } from "@/components/form/inquiry-form";
import { SetupGuideLink } from "@/components/help/setup-guide-link";
import { EmailIntakeSection } from "@/components/settings/email-intake-section";
import { InquiryFormConfigSection } from "@/components/settings/inquiry-form-config-section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EmailIntakeHealthView } from "@/lib/lead-intake/email-intake-health";
import type { EmailIntakeStatus } from "@/lib/lead-intake/email-status";
import type { GmailVerificationCustomerView } from "@/lib/lead-intake/gmail-forwarding-verification";
import {
  INQUIRY_FORM_PREVIEW_BANNER,
  applyInquiryFormDraftToPublicConfig,
  type InquiryFormBuilderDraft,
} from "@/lib/inquiry-form/preview-config";
import type { InquiryFormSettings, PublicInquiryFormConfig } from "@/lib/inquiry-form/types";

const WEBSITE_BUILDER_STEPS: { name: string; steps: string[] }[] = [
  {
    name: "Squarespace",
    steps: [
      "Sign in to Squarespace and open your website.",
      "Navigate to the page where you'd like your inquiry form to appear.",
      "Select Edit.",
      "Add a Code Block in the desired location.",
      "Set the block to HTML, where applicable.",
      "Paste your Hello to Cheers embed code.",
      "Save your changes and preview the page.",
    ],
  },
  {
    name: "Wix",
    steps: [
      "Sign in to Wix and open your website editor.",
      "Navigate to your desired inquiry or contact page.",
      "Open the Add Elements menu.",
      "Locate the Embed Code or HTML embed option.",
      "Add an HTML embed element to your page.",
      "Paste your Hello to Cheers embed code.",
      "Adjust the element's size so the form is comfortably displayed.",
      "Preview and publish your changes.",
    ],
  },
  {
    name: "WordPress",
    steps: [
      "Sign in to your WordPress dashboard.",
      "Open the page where you'd like to display your inquiry form.",
      "Add a Custom HTML block.",
      "Paste your Hello to Cheers embed code.",
      "Preview the page.",
      "Save or publish your changes.",
    ],
  },
  {
    name: "Other website providers",
    steps: [
      "Look for an HTML, Code or Embed element in your website editor.",
      "Paste the embed code provided by Hello to Cheers.",
      "If your website provider doesn't support embedded forms, use your direct inquiry form link instead.",
    ],
  },
];

export function WebsiteFormsSection({
  embedKey,
  appUrl,
  leadEmailAddress,
  emailIntakeStatus,
  intakeHealth = null,
  gmailVerification = null,
  inquiryFormSettings = null,
  canEditInquiryForm = true,
  previewBaseConfig = null,
}: {
  embedKey: string;
  appUrl: string;
  /** null when RESEND_INBOUND_ADDRESS isn't configured platform-wide. */
  leadEmailAddress: string | null;
  emailIntakeStatus: EmailIntakeStatus | null;
  intakeHealth?: EmailIntakeHealthView | null;
  gmailVerification?: GmailVerificationCustomerView | null;
  inquiryFormSettings?: InquiryFormSettings | null;
  canEditInquiryForm?: boolean;
  /** Saved public shell (venue brand / tour flags). Draft overlays this for Preview. */
  previewBaseConfig?: PublicInquiryFormConfig | null;
}) {
  const formUrl = `${appUrl}/form/${embedKey}`;
  const iframeCode = `<iframe\n  src="${formUrl}"\n  width="100%"\n  height="700"\n  frameborder="0"\n  title="Venue Inquiry Form"\n></iframe>`;

  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const [copiedEmbed, setCopiedEmbed] = React.useState(false);
  const [openBuilder, setOpenBuilder] = React.useState<string | null>(null);
  const draftGetterRef = React.useRef<(() => InquiryFormBuilderDraft) | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewConfig, setPreviewConfig] = React.useState<PublicInquiryFormConfig | null>(null);

  function copy(text: string, which: "url" | "embed") {
    navigator.clipboard.writeText(text);
    if (which === "url") { setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000); }
    else { setCopiedEmbed(true); setTimeout(() => setCopiedEmbed(false), 2000); }
  }

  const registerDraftGetter = React.useCallback((getDraft: () => InquiryFormBuilderDraft) => {
    draftGetterRef.current = getDraft;
  }, []);

  function openPreview() {
    if (!previewBaseConfig || !draftGetterRef.current) return;
    setPreviewConfig(applyInquiryFormDraftToPublicConfig(previewBaseConfig, draftGetterRef.current()));
    setPreviewOpen(true);
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Your venue&apos;s inquiry form connects directly to Hello to Cheers, so new inquiries arrive in your Leads workspace, ready for follow-up.
      </p>

      {inquiryFormSettings && (
        <div className="htc-surface-working space-y-3 p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-heading">Inquiry form fields</p>
            <p className="text-xs text-muted-foreground">
              Review your inquiry form settings and customize the available options to reflect your venue and the types of events you host.
            </p>
          </div>
          <InquiryFormConfigSection
            initialEventDateMode={inquiryFormSettings.inquiryEventDateMode}
            initialFields={inquiryFormSettings.inquiryFormFields}
            initialAcceptedEventTypes={inquiryFormSettings.acceptedEventTypes}
            initialQuestions={inquiryFormSettings.customQuestions}
            initialCommunicationSettings={inquiryFormSettings.inquiryCommunicationSettings}
            smsConsentOfferAvailable={inquiryFormSettings.smsConsentOfferAvailable}
            canEdit={canEditInquiryForm}
            registerDraftGetter={registerDraftGetter}
            onPreviewForm={previewBaseConfig ? openPreview : undefined}
          />
        </div>
      )}

      <div className="htc-surface-guidance space-y-3 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-heading">Add to your website</p>
          <p className="text-xs text-muted-foreground">
            Display your inquiry form directly on your existing website for a seamless visitor experience.
          </p>
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

      <div className="htc-surface-guidance space-y-3 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-heading">Share your inquiry form</p>
          <p className="text-xs text-muted-foreground">
            Add your form link to website buttons, social media profiles, emails and more.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 min-w-[12rem] rounded-md bg-muted border border-border px-3 py-2 text-xs font-mono text-foreground truncate">
            {formUrl}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={() => copy(formUrl, "url")}>
            {copiedUrl ? <><Check className="mr-1 h-3.5 w-3.5" />Copied!</> : <><Copy className="mr-1 h-3.5 w-3.5" />Copy link</>}
          </Button>
          <Button type="button" variant="outline" size="sm" render={<a href={formUrl} target="_blank" rel="noopener noreferrer" />}>
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            Open form
          </Button>
          {previewBaseConfig && inquiryFormSettings && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openPreview}
              data-testid="inquiry-form-preview-open"
            >
              <Eye className="mr-1 h-3.5 w-3.5" />
              Preview form
            </Button>
          )}
        </div>
      </div>

      <div className="htc-surface-guidance space-y-3 p-4">
        <p className="text-sm font-medium text-foreground">Add your inquiry form to your website</p>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">1. Preview your form</span>
            <p className="mt-0.5 text-xs">Review your inquiry settings and make sure your form reflects your venue.</p>
          </li>
          <li>
            <span className="font-medium text-foreground">2. Add it to your website</span>
            <p className="mt-0.5 text-xs">
              Copy your embed code to display the form on your website, or use your form link behind an inquiry button.
            </p>
          </li>
          <li>
            <span className="font-medium text-foreground">3. Try it out</span>
            <p className="mt-0.5 text-xs">Submit a test inquiry and confirm it appears in your Leads workspace.</p>
          </li>
        </ol>

        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Instructions for your website provider
          </p>
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

        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Someone else manages your website?</span>{" "}
          Simply send your website designer your embed code or inquiry form link. They&apos;ll have what they need to add your form.
        </p>

        <SetupGuideLink
          href="/help/how-to-add-your-inquiry-form-to-your-website"
          label="View the complete website inquiry form guide"
        />
      </div>

      <EmailIntakeSection
        status={emailIntakeStatus}
        leadEmailAddress={leadEmailAddress}
        intakeHealth={intakeHealth}
        gmailVerification={gmailVerification}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          className="max-h-[min(92vh,52rem)] w-[calc(100%-1.5rem)] overflow-y-auto p-0 sm:max-w-2xl"
          showCloseButton
        >
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle>Preview form</DialogTitle>
            <DialogDescription>{INQUIRY_FORM_PREVIEW_BANNER}</DialogDescription>
          </DialogHeader>
          {previewConfig && (
            <div className="border-t border-border">
              <InquiryForm
                embedKey={embedKey}
                config={previewConfig}
                preview
                initialMode="request_information"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
