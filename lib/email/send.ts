/**
 * Email sending utility (Sprint 28).
 *
 * Uses the Resend API (https://resend.com) when RESEND_API_KEY is configured.
 * Falls back gracefully when no key is present — callers receive a mailto: URL
 * to open the user's native email client.
 *
 * Required env vars:
 *   RESEND_API_KEY   — server only, never expose to browser
 *   FROM_EMAIL       — optional, e.g. "Wildflower Estate <invoices@wildflower.com>"
 *                      defaults to Resend's shared test address in development
 *
 * See lib/communication/mode.ts for COMMUNICATION_MODE (real/sandbox/
 * disabled) and COMMUNICATION_SANDBOX_EMAIL — Communication Infrastructure
 * Readiness, Phase 2.
 */

import { getCommunicationMode, sandboxEmailRecipient } from "@/lib/communication/mode";

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;       // plain text body
  html?: string;      // optional rich HTML body
  replyTo?: string;   // venue contact email
  threadId?: string;  // when set, Reply-To routes through inbound for thread matching
};

export type SendResult =
  | { ok: true; method: "resend" | "mailto" | "disabled"; providerId?: string; mailtoUrl?: string; sandboxRedirectedFrom?: string }
  | { ok: false; message: string };

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(payload: EmailPayload): Promise<SendResult> {
  const mode = getCommunicationMode();
  if (mode === "disabled") {
    return { ok: true, method: "disabled" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL ?? "Wevenu <onboarding@resend.dev>";

  let recipient = payload.to;
  let sandboxRedirectedFrom: string | undefined;
  if (mode === "sandbox") {
    const sandboxTo = sandboxEmailRecipient();
    if (sandboxTo) {
      sandboxRedirectedFrom = payload.to;
      recipient = sandboxTo;
    }
    // No COMMUNICATION_SANDBOX_EMAIL configured — falls through and sends
    // to the real recipient anyway rather than silently no-op'ing; sandbox
    // mode without a redirect target isn't a safe substitute for "real".
  }

  // --- Resend API path ---
  if (apiKey) {
    const body: Record<string, unknown> = {
      from: fromEmail,
      to: [recipient],
      subject: payload.subject,
      text: payload.text,
      // Enable delivery + engagement tracking so signals flow back into Wevenu
      // via the /api/messaging/webhook route. These fire email.opened and
      // email.clicked events which become lead_signal_events entries.
      open_tracking: true,
      click_tracking: true,
    };
    if (payload.html) body.html = payload.html;
    // Reply-To: route through inbound address if configured, otherwise venue email
    const inboundAddress = process.env.RESEND_INBOUND_ADDRESS;
    const replyTo = payload.threadId && inboundAddress
      ? `thread+${payload.threadId}@${inboundAddress.replace(/^.*@/, "")}` // subaddressing for thread matching
      : (payload.replyTo ?? null);
    if (replyTo) body.reply_to = replyTo;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, message: `Email send failed: ${err}` };
    }
    // Resend's own message id — without this, no delivery/open/click/bounce
    // webhook can ever be matched back to this send (it matches on this id
    // alone). Previously discarded entirely; see docs/communication-trust-
    // experience.md, Phase 1 — this was the root cause of every real send
    // being permanently untrackable regardless of which table it lived in.
    const data = await res.json().catch(() => null) as { id?: string } | null;
    return { ok: true, method: "resend", providerId: data?.id, sandboxRedirectedFrom };
  }

  // --- mailto fallback ---
  const mailtoUrl = buildMailtoUrl({ ...payload, to: recipient });
  return { ok: true, method: "mailto", mailtoUrl, sandboxRedirectedFrom };
}

function buildMailtoUrl(payload: EmailPayload): string {
  const params = new URLSearchParams({
    subject: payload.subject,
    body: payload.text,
  });
  return `mailto:${encodeURIComponent(payload.to)}?${params.toString()}`;
}
