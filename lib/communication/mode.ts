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
 *   "disabled" — no network call for business traffic.
 *
 * Essential authentication / account-access email categories still deliver
 * when mode is `disabled` (and are not sandbox-redirected) so password
 * recovery and invites work without enabling business communications.
 */

import type { EmailSendCategory } from "@shared/email/pacing/priority";

export type CommunicationMode = "real" | "sandbox" | "disabled";

/** Narrow allowlist — must not include conversation / marketing / automation mail. */
export const ESSENTIAL_AUTH_EMAIL_CATEGORIES = new Set<EmailSendCategory>([
  "password_recovery",
  "account_invite",
  "team_invite",
  "client_portal_invite",
  "vendor_invite",
]);

export function isEssentialAuthEmailCategory(
  category: EmailSendCategory | string | undefined | null,
): boolean {
  if (!category) return false;
  return ESSENTIAL_AUTH_EMAIL_CATEGORIES.has(category as EmailSendCategory);
}

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
