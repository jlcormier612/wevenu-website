/**
 * Progressive Disclosure for composer readiness copy.
 * Underlying channelReady / sendDisabled rules are unchanged — this only
 * decides when customer-facing readiness messaging is shown.
 */
export type ComposeReadinessUiMode = "outbound" | "internal_note";

export function shouldShowEmailReadinessBanner(input: {
  mode: ComposeReadinessUiMode;
  /** Active sendable channel (email | sms | portal | internal_note). */
  channel: string;
  emailReady: boolean;
}): boolean {
  if (input.mode === "internal_note") return false;
  if (input.channel !== "email") return false;
  return !input.emailReady;
}

export function shouldShowSmsReadinessBanner(input: {
  mode: ComposeReadinessUiMode;
  channel: string;
  smsReady: boolean;
}): boolean {
  if (input.mode === "internal_note") return false;
  if (input.channel !== "sms") return false;
  return !input.smsReady;
}
