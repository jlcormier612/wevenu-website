/**
 * Communication Mode — Communication Infrastructure Readiness, Phase 2.
 *
 * Before this, the only "sandbox" for Email/SMS was the implicit fallback
 * inside sendEmail/sendSms when a provider key was simply unset — which
 * also prevented testing anything past the send call (no real API round
 * trip, no webhook to receive). This makes the choice explicit and gives a
 * real third option: send for real, through the real provider, to a fixed
 * developer-controlled recipient instead of a real lead/client.
 *
 * COMMUNICATION_MODE:
 *   "real"     (default) — unchanged behavior: send to the real recipient.
 *   "sandbox"  — still calls the real provider (so the full send → webhook
 *                → status pipeline is genuinely exercisable), but every
 *                send is redirected to COMMUNICATION_SANDBOX_EMAIL /
 *                COMMUNICATION_SANDBOX_PHONE instead of the real recipient.
 *   "disabled" — no network call at all, to any provider.
 */

export type CommunicationMode = "real" | "sandbox" | "disabled";

export function getCommunicationMode(): CommunicationMode {
  const mode = process.env.COMMUNICATION_MODE;
  if (mode === "sandbox" || mode === "disabled") return mode;
  return "real";
}

export function sandboxEmailRecipient(): string | null {
  return process.env.COMMUNICATION_SANDBOX_EMAIL?.trim() || null;
}

export function sandboxPhoneRecipient(): string | null {
  return process.env.COMMUNICATION_SANDBOX_PHONE?.trim() || null;
}
