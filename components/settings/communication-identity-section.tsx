"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { updateEmailFooterContactPrefsAction } from "@/app/(app)/settings/communication-identity-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  emailBrandFromVenue,
  renderEmailBrandPreviewHtml,
} from "@/lib/email/venue-brand";
import { useSyncedState } from "@/lib/hooks/use-synced-state";
import { formatPhoneDisplay } from "@/lib/sms/phone";

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
  emailFooterShowSignature: initialShowSignature = true,
  emailFooterShowEmail: initialShowEmail = true,
  emailFooterShowPhone: initialShowPhone = false,
  emailConfigured,
  smsConfigured,
  textingNumberDisplay = null,
}: {
  venueName: string;
  logoUrl: string | null;
  primaryColor: string;
  venueEmail: string | null;
  venuePhone: string | null;
  emailSignature: string | null;
  emailFooterShowSignature?: boolean;
  emailFooterShowEmail?: boolean;
  emailFooterShowPhone?: boolean;
  emailConfigured: boolean;
  smsConfigured: boolean;
  /** Venue texting number when ready — never provider SIDs. */
  textingNumberDisplay?: string | null;
}) {
  const [signature, setSignature] = useSyncedState(initialSignature ?? "");
  const [showSignature, setShowSignature] = useSyncedState(initialShowSignature);
  const [showEmail, setShowEmail] = useSyncedState(initialShowEmail);
  const [showPhone, setShowPhone] = useSyncedState(initialShowPhone);
  const [saving, setSaving] = React.useState(false);

  const dirty =
    signature !== (initialSignature ?? "") ||
    showSignature !== initialShowSignature ||
    showEmail !== initialShowEmail ||
    showPhone !== initialShowPhone;

  const previewHtml = renderEmailBrandPreviewHtml(
    emailBrandFromVenue({
      name: venueName || "Your venue",
      logoUrl,
      primaryColor: primaryColor || "#5D6F5D",
      emailSignature: signature,
      email: venueEmail,
      phone: venuePhone,
      emailFooterShowSignature: showSignature,
      emailFooterShowEmail: showEmail,
      emailFooterShowPhone: showPhone,
    }),
  );

  const phoneLabel = venuePhone?.trim()
    ? formatPhoneDisplay(venuePhone) || venuePhone
    : "No phone on file";

  async function saveFooter() {
    setSaving(true);
    try {
      const result = await updateEmailFooterContactPrefsAction({
        signature,
        showSignature,
        showEmail,
        showPhone,
      });
      if (!result.ok) throw new Error(result.message ?? "save failed");
      toast.success("Email footer settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save email footer settings.");
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
        . Email delivery is managed by Hello to Cheers. Texting is enabled per venue in{" "}
        <Link href="/settings/communications#texting" className="underline underline-offset-2 text-heading">
          Text messaging
        </Link>
        .
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
          <Row
            label="Brand color"
            value={
              primaryColor ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-4 w-4 shrink-0 rounded-sm border border-border"
                    style={{ backgroundColor: primaryColor }}
                  />
                  <span>{primaryColor}</span>
                </span>
              ) : (
                "Default"
              )
            }
            hint="Accent bar on the email."
          />
          <Row
            label="From address"
            value={emailConfigured ? "Platform sender (Hello to Cheers delivery)" : "Email not connected"}
            hint="Platform FROM_EMAIL — clients still see your venue name and logo in the message."
          />
          <Row
            label="Reply / contact"
            value={
              venueEmail ? (
                <div className="space-y-1">
                  <p>Replies to your messages are routed to your Inbox automatically.</p>
                  <p>Stored contact: {venueEmail}</p>
                </div>
              ) : (
                "Set your venue contact email in Business & Brand"
              )
            }
            hint="Footer visibility for this address is controlled below. Turning it off does not delete it."
          />
        </dl>

        <div className="rounded-sm border border-border p-4 space-y-4 bg-card">
          <div>
            <p className="text-sm font-medium text-heading">Email signature / footer</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Applied automatically to outbound venue emails — staff do not paste this manually.
              Choose which contact details customers see beneath your sign-off.
            </p>
          </div>
          <Textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            rows={4}
            placeholder={"Warmly,\nThe team at your venue"}
            className="text-sm"
            disabled={!showSignature}
          />

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-heading">What customers see in the footer</legend>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={showSignature}
                onCheckedChange={(v) => setShowSignature(Boolean(v))}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-heading">Show venue / team sign-off</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  The signature text above (for example “Warmly,” and your team name).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={showEmail}
                onCheckedChange={(v) => setShowEmail(Boolean(v))}
                disabled={!venueEmail?.trim()}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-heading">Show venue email address</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {venueEmail?.trim()
                    ? `Customers see ${venueEmail.trim()} in the footer when this is on.`
                    : "Add a venue email in Business & Brand before enabling this."}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={showPhone}
                onCheckedChange={(v) => setShowPhone(Boolean(v))}
                disabled={!venuePhone?.trim()}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-heading">Show venue phone number</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  Off by default so customers are not invited to call unless you choose it.
                  {venuePhone?.trim()
                    ? ` Stored number: ${phoneLabel}.`
                    : " Add a phone in Business & Brand before enabling this."}
                </span>
              </span>
            </label>
          </fieldset>

          <div className="flex items-center gap-2">
            <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void saveFooter()}>
              {saving ? "Saving…" : "Save email footer"}
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
                ? (textingNumberDisplay ?? "Your venue’s dedicated texting number")
                : "Texting not connected"
            }
            hint={
              smsConfigured
                ? "Clients see this number on texts. Logos and HTML signatures do not apply to SMS."
                : "Enable text messaging in Settings → Communications when you’re ready."
            }
          />
          <Row
            label="Message body"
            value="The message you write — exactly what the client receives"
            hint="Keep SMS concise. Include your venue name when it helps the client know who’s messaging them."
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
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="px-4 py-3.5 bg-card grid gap-1 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-heading">{label}</dt>
      <dd>
        <div className="text-sm text-foreground">{value}</div>
        {hint ? <p className="text-xs text-muted-foreground mt-0.5">{hint}</p> : null}
      </dd>
    </div>
  );
}
