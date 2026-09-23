/**
 * Human-facing communication preferences + SMS permission evidence on a
 * Lead/Client record. Does not allow overriding enforced opt-out.
 */

import type { CommunicationPermissionStatus } from "@/lib/communication/permissions";
import {
  preferredChannelLabel,
  smsPermissionDisplayLabel,
  smsPermissionSourceLabel,
  SMS_PERMISSION_SOURCE_CONSENT_REQUEST,
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
}: {
  preferredChannels: PreferredCommunicationChannel[];
  sms: SmsPermissionEvidenceView | null;
  /** When set with hasPhone and not_opted_in, shows Request text permission. */
  leadId?: string;
  hasPhone?: boolean;
}) {
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
    smsStatus === "not_opted_in" && sms?.source === SMS_PERMISSION_SOURCE_CONSENT_REQUEST;
  const canRequestConsent =
    Boolean(leadId) && Boolean(hasPhone) && smsStatus === "not_opted_in";

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Communication preferences
      </p>
      <p className="text-sm text-foreground">
        <span className="text-muted-foreground">Preferred: </span>
        {preferredLabel}
      </p>
      <div className="space-y-0.5">
        <p className="text-sm text-foreground">
          <span className="text-muted-foreground">Text messages: </span>
          <span className={smsDot}>●</span>{" "}
          {smsPermissionDisplayLabel(smsStatus)}
        </p>
        {sourceLine && (smsStatus !== "not_opted_in" || consentRequested) && (
          <p className="text-xs text-muted-foreground">
            {sourceLine}
            {when ? ` · ${when}` : ""}
          </p>
        )}
        {smsStatus === "not_opted_in" && !consentRequested && (
          <p className="text-xs text-muted-foreground">
            No text permission on file. Texts cannot be sent until they opt in.
          </p>
        )}
        {consentRequested && (
          <p className="text-xs text-muted-foreground">
            Permission request sent. Ordinary texts stay blocked until they reply START.
          </p>
        )}
        {canRequestConsent && leadId && (
          <RequestSmsConsentButton leadId={leadId} alreadyRequested={consentRequested} />
        )}
      </div>
    </div>
  );
}
