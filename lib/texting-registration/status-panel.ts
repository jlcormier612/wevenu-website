/**
 * Derive venue-facing status panel rows from HTC phase + provider send readiness.
 * Never labels business info “Verified” without a real verification event —
 * use Confirmed / Ready / Pending / Needs attention / Not ready / Paused / Saved.
 *
 * information_saved = HTC has details; provider registration is NOT underway.
 * under_review = provider registration actually accepted/submitted.
 */
import type {
  TextingPhase,
  TextingPanelTone,
  TextingRegistrationView,
  TextingStatusPanel,
} from "@/lib/texting-registration/types";
import { INFORMATION_SAVED_STATUS_COPY } from "@/lib/texting-registration/types";
import { canResubmitTextingRegistration } from "@/lib/texting-registration/lifecycle";
import { isBusinessIdentityComplete, toTextingInput } from "@/lib/texting-registration/validation";

function row(label: string, tone: TextingPanelTone) {
  return { label, tone };
}

export function buildTextingStatusPanel(input: {
  registration: TextingRegistrationView | null;
  phase: TextingPhase;
  smsReady: boolean;
  textingNumberE164: string | null;
}): TextingStatusPanel {
  const { registration, phase, smsReady, textingNumberE164 } = input;
  const businessComplete = registration
    ? isBusinessIdentityComplete(toTextingInput(registration))
    : false;
  const businessConfirmed = !!registration?.businessConfirmedAt || businessComplete;

  let businessInformation = row("Not ready", "not_ready" as TextingPanelTone);
  if (phase === "paused") businessInformation = row("Paused", "paused");
  else if (businessConfirmed) businessInformation = row("Confirmed", "confirmed");
  else if (phase !== "not_started") businessInformation = row("Needs attention", "needs_attention");

  let messagingRegistration = row("Not ready", "not_ready" as TextingPanelTone);
  switch (phase) {
    case "not_started":
    case "details_needed":
      messagingRegistration = row("Not ready", "not_ready");
      break;
    case "information_saved":
      // Honest Track A: saved with HTC, not pending provider approval.
      messagingRegistration = row("Saved", "confirmed");
      break;
    case "under_review":
      messagingRegistration = row("Pending", "pending");
      break;
    case "needs_attention":
    case "failed":
      messagingRegistration = row("Needs attention", "needs_attention");
      break;
    case "setting_up_number":
    case "ready":
      messagingRegistration = row("Ready", "ready");
      break;
    case "paused":
      messagingRegistration = row("Paused", "paused");
      break;
  }

  let textingNumber: { label: string; tone: TextingPanelTone; e164: string | null } = {
    label: "Not yet assigned",
    tone: "not_ready",
    e164: null,
  };
  if (textingNumberE164) {
    textingNumber = {
      label: formatUsPhoneDisplay(textingNumberE164),
      tone: "ready",
      e164: textingNumberE164,
    };
  } else if (phase === "setting_up_number") {
    textingNumber = { label: "Pending", tone: "pending", e164: null };
  } else if (phase === "paused") {
    textingNumber = {
      label: "Paused",
      tone: "paused",
      e164: null,
    };
  }

  let texting = row("Not ready", "not_ready" as TextingPanelTone);
  if (smsReady) texting = row("Ready", "ready");
  else if (phase === "paused") texting = row("Paused", "paused");
  else if (phase === "failed" || phase === "needs_attention") {
    texting = row("Needs attention", "needs_attention");
  }

  const attention =
    phase === "needs_attention" || phase === "failed"
      ? {
          code: registration?.attentionCode ?? null,
          message: registration?.attentionMessage
            ?? (phase === "failed"
              ? "Texting setup ran into a problem. You can review your details and try again, or contact support."
              : "Texting setup needs attention. Additional business information is required."),
          fixHint: registration?.attentionFixHint
            ?? "Update the highlighted details, then resubmit.",
        }
      : phase === "information_saved"
        ? {
            code: "information_saved",
            message: INFORMATION_SAVED_STATUS_COPY,
            fixHint: null,
          }
        : null;

  return {
    businessInformation,
    messagingRegistration,
    textingNumber,
    texting,
    attention,
    phase,
    canResubmit: canResubmitTextingRegistration(phase),
    smsReady,
  };
}

/** True when venue-facing strings claim provider registration is pending/in flight. */
export function impliesProviderRegistrationPending(text: string): boolean {
  return /registration is pending|when it(?:'|’)s approved|provider registration|awaiting approval|under review with|being reviewed/i
    .test(text);
}

/** Light US display helper — not a general phone library. */
export function formatUsPhoneDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return e164;
}

/** Guard: venue UI strings must not leak provider jargon. */
export function assertNoProviderLeak(text: string): void {
  const banned = [
    /twilio/i,
    /trust\s*hub/i,
    /\ba2p\b/i,
    /10dlc/i,
    /messaging\s*service/i,
    /\bAC[0-9a-f]{32}\b/i,
    /\bMG[0-9a-f]{32}\b/i,
    /\bBN[0-9a-f]{32}\b/i,
    /brand\s*sid/i,
    /campaign\s*sid/i,
    /account\s*sid/i,
    /auth\s*token/i,
  ];
  for (const re of banned) {
    if (re.test(text)) {
      throw new Error("Provider identifier leaked into venue-facing copy.");
    }
  }
}
