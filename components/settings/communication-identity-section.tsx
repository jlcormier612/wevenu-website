"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { updateEmailSignatureAction } from "@/app/(app)/settings/communication-identity-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { renderEmailBrandPreviewHtml } from "@/lib/email/venue-brand";
import { useSyncedState } from "@/lib/hooks/use-synced-state";

/**
 * Answers: "What will my client actually see when HTC sends a message?"
 * Separates email vs SMS, and platform delivery vs venue-facing identity.
 */
export function CommunicationIdentitySection({
  venueName,
  logoUrl,
  primaryColor,
  venueEmail,
  venuePhone,
  emailSignature: initialSignature,
  emailConfigured,
  smsConfigured,
}: {
  venueName: string;
  logoUrl: string | null;
  primaryColor: string;
  venueEmail: string | null;
  venuePhone: string | null;
  emailSignature: string | null;
  emailConfigured: boolean;
  smsConfigured: boolean;
}) {
  const [signature, setSignature] = useSyncedState(initialSignature ?? "");
  const [saving, setSaving] = React.useState(false);
  const dirty = signature !== (initialSignature ?? "");

  const previewHtml = renderEmailBrandPreviewHtml({
    name: venueName || "Your venue",
    logoUrl,
    primaryColor: primaryColor || "#5D6F5D",
    emailSignature: signature,
    replyContact: [venueEmail, venuePhone].filter(Boolean).join(" · ") || null,
  });

  async function saveSignature() {
    setSaving(true);
    try {
      const result = await updateEmailSignatureAction(signature);
      if (!result.ok) throw new Error(result.message ?? "save failed");
      toast.success("Email signature saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save signature.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 text-sm">
      <p className="text-muted-foreground">
        This is what your client sees when Hello to Cheers sends on your behalf. Brand name, logo, and
        colors are edited in{" "}
        <Link href="/settings/business" className="underline underline-offset-2 text-heading">
          Business &amp; Brand
        </Link>
        . Delivery providers (Resend / Twilio) are platform-managed — not venue credentials.
      </p>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-heading">Email — what the client receives</h3>
        <dl className="divide-y divide-border rounded-sm border border-border overflow-hidden">
          <Row label="Venue name" value={venueName || "Not set"} hint="Header on every branded email." />
          <Row
            label="Logo"
            value={logoUrl ? "Uploaded" : "Not uploaded"}
            hint="Shown at the top of the email when present."
          />
          <Row label="Brand color" value={primaryColor || "Default"} hint="Accent bar on the email." />
          <Row
            label="From address"
            value={emailConfigured ? "Platform sender (Hello to Cheers delivery)" : "Email not connected"}
            hint="Platform FROM_EMAIL — clients still see your venue name and logo in the message."
          />
          <Row
            label="Reply / contact"
            value={
              venueEmail
                ? `Replies can route into Inbox when inbound is configured; contact shown as ${venueEmail}`
                : "Set your venue contact email in Business & Brand"
            }
            hint="Conversation emails can use thread matching when inbound email is configured."
          />
        </dl>

        <div className="rounded-sm border border-border p-4 space-y-3 bg-card">
          <div>
            <p className="text-sm font-medium text-heading">Email signature / footer</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Applied automatically to outbound venue emails — staff do not paste this manually.
            </p>
          </div>
          <Textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            rows={4}
            placeholder={"Warmly,\nThe team at your venue\n(555) 555-0100"}
            className="text-sm"
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void saveSignature()}>
              {saving ? "Saving…" : "Save signature"}
            </Button>
            {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
          </div>
        </div>

        <div className="rounded-sm border border-border overflow-hidden">
          <p className="text-xs font-medium text-heading px-3 py-2 bg-muted/40 border-b border-border">
            Approximate client preview
          </p>
          <iframe
            title="Email brand preview"
            sandbox=""
            srcDoc={previewHtml}
            className="w-full h-[320px] bg-[#f9fafb]"
          />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-heading">Text (SMS) — what the client receives</h3>
        <dl className="divide-y divide-border rounded-sm border border-border overflow-hidden">
          <Row
            label="Sender identity"
            value={
              smsConfigured
                ? "Platform Twilio number / Messaging Service"
                : "Texting not connected"
            }
            hint="Clients see the from-number. Logos and HTML signatures do not apply to SMS."
          />
          <Row
            label="Message body"
            value="The text you (or automation) write — no email-style footer"
            hint="Keep SMS short; venue name can appear in the wording when helpful."
          />
        </dl>
      </div>

      <p className="text-xs text-muted-foreground">
        Message templates inherit this email brand automatically when sent as email.{" "}
        <Link href="/settings/business" className="underline underline-offset-2 text-heading">
          Edit venue name, logo, and brand colors
        </Link>
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="px-4 py-3.5 bg-card grid gap-1 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-heading">{label}</dt>
      <dd>
        <p className="text-sm text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      </dd>
    </div>
  );
}
