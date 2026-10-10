/**
 * Human-facing communication preferences + SMS permission evidence on a
 * Lead/Client record. Does not allow overriding enforced opt-out.
 */

"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { CommunicationPermissionStatus } from "@/lib/communication/permissions";
import {
  preferredChannelLabel,
  smsPermissionDisplayLabel,
  smsPermissionSourceLabel,
  SMS_PERMISSION_SOURCE_CONSENT_REQUEST,
  SMS_PERMISSION_SOURCE_EMAIL_CONSENT_REQUEST,
  type PreferredCommunicationChannel,
} from "@/lib/communication/sms-consent";
import { RequestSmsConsentButton } from "@/components/leads/request-sms-consent-button";

export type SmsPermissionEvidenceView = {
  status: CommunicationPermissionStatus;
  source: string | null;
  updatedAt: string | null;
  consentText: string | null;
};

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export function RelationshipCommunicationSummary({
  preferredChannels,
  sms,
  leadId,
  hasPhone,
  hasEmail,
  textingConfigured,
}: {
  preferredChannels: PreferredCommunicationChannel[];
  sms: SmsPermissionEvidenceView | null;
  /** When set with hasPhone and not_opted_in, shows consent request controls. */
  leadId?: string;
  hasPhone?: boolean;
  hasEmail?: boolean;
  textingConfigured?: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  const preferredLabel = preferredChannels.length
    ? preferredChannels.map(preferredChannelLabel).join(", ")
    : "Not specified";

  const smsStatus = sms?.status ?? "not_opted_in";
  const smsDot =
    smsStatus === "opted_in" ? "text-emerald-600"
    : smsStatus === "opted_out" || smsStatus === "provider_blocked" ? "text-red-600"
    : "text-muted-foreground";

  const when = formatWhen(sms?.updatedAt ?? null);
  const sourceLine = sms ? smsPermissionSourceLabel(sms.source) : null;
  const consentRequested =
    smsStatus === "not_opted_in" &&
    (sms?.source === SMS_PERMISSION_SOURCE_CONSENT_REQUEST ||
      sms?.source === SMS_PERMISSION_SOURCE_EMAIL_CONSENT_REQUEST);

  const panelId = "communication-preferences-panel";

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
      <button
        type="button"
        className="flex w-full min-h-9 items-center justify-between gap-2 text-left"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        data-testid="communication-preferences-toggle"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Communication Preferences
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className={smsDot} aria-hidden>
            ●
          </span>
          <span data-testid="communication-preferences-status">
            {smsPermissionDisplayLabel(smsStatus)}
          </span>
        </span>
      </button>

      {open ? (
        <div id={panelId} className="mt-2 space-y-2" data-testid="communication-preferences-content">
          <p className="text-sm text-foreground">
            <span className="text-muted-foreground">Preferred: </span>
            {preferredLabel}
          </p>

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-heading">Text messaging</p>
            <p className="text-sm text-foreground">
              <span className={smsDot}>●</span>{" "}
              {smsPermissionDisplayLabel(smsStatus)}
            </p>

            {smsStatus === "opted_in" && (
              <>
                <p className="text-xs text-muted-foreground">
                  This person gave permission to receive text messages.
                </p>
                {sourceLine && (
                  <p className="text-xs text-muted-foreground">
                    {sourceLine}
                    {when ? ` · ${when}` : ""}
                  </p>
                )}
              </>
            )}

            {(smsStatus === "opted_out" || smsStatus === "provider_blocked") && sourceLine && (
              <p className="text-xs text-muted-foreground">
                {sourceLine}
                {when ? ` · ${when}` : ""}
              </p>
            )}

            {smsStatus === "not_opted_in" && (
              <>
                <p className="text-xs text-muted-foreground">
                  This person hasn&apos;t opted in to receive text messages from your venue.
                </p>
                <p className="text-xs text-muted-foreground">
                  Hello to Cheers requires the person&apos;s permission before you can send them text
                  messages through Hello to Cheers.
                </p>
                {consentRequested && sourceLine && (
                  <p className="text-xs text-muted-foreground">
                    {sourceLine}
                    {when ? ` · ${when}` : ""}
                  </p>
                )}
                {leadId && (
                  <RequestSmsConsentButton
                    leadId={leadId}
                    alreadyRequested={consentRequested}
                    hasPhone={hasPhone}
                    hasEmail={hasEmail}
                    textingConfigured={textingConfigured}
                  />
                )}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
