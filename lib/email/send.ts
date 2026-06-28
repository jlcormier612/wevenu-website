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
 */

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;       // plain text body
  html?: string;      // optional rich HTML body
  replyTo?: string;   // venue contact email
};

export type SendResult =
  | { ok: true; method: "resend" | "mailto"; mailtoUrl?: string }
  | { ok: false; message: string };

export async function sendEmail(payload: EmailPayload): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL ?? "Wevenu <onboarding@resend.dev>";

  // --- Resend API path ---
  if (apiKey) {
    const body: Record<string, unknown> = {
      from: fromEmail,
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
    };
    if (payload.html) body.html = payload.html;
    if (payload.replyTo) body.reply_to = payload.replyTo;

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
    return { ok: true, method: "resend" };
  }

  // --- mailto fallback ---
  const mailtoUrl = buildMailtoUrl(payload);
  return { ok: true, method: "mailto", mailtoUrl };
}

function buildMailtoUrl(payload: EmailPayload): string {
  const params = new URLSearchParams({
    subject: payload.subject,
    body: payload.text,
  });
  return `mailto:${encodeURIComponent(payload.to)}?${params.toString()}`;
}
