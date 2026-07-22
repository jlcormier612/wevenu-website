/**
 * Resend transport for Hello to Cheers product + ops email.
 *
 * Env (preferred):
 *   RESEND_API_KEY
 *   EMAIL_FROM          e.g. "Hello to Cheers <hello@hellotocheers.com>"
 *   EMAIL_REPLY_TO      optional
 *
 * Back-compat aliases (marketing ops notify already used these):
 *   FROM_EMAIL  → same as EMAIL_FROM
 */

import type { RawSendResult } from "./types";

export type RawEmailPayload = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  /** Optional tags for Resend dashboard filtering */
  tags?: Array<{ name: string; value: string }>;
};

export function getEmailFromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.FROM_EMAIL?.trim() ||
    "Hello to Cheers <onboarding@resend.dev>"
  );
}

export function getEmailReplyTo(): string | undefined {
  const reply =
    process.env.EMAIL_REPLY_TO?.trim() ||
    process.env.REPLY_TO_EMAIL?.trim() ||
    undefined;
  return reply || undefined;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/**
 * Send via Resend when configured; otherwise dry-run to console and return simulated.
 * Does not touch the Relationship timeline — use sendRelationshipEmail for that.
 */
export async function sendRawEmail(payload: RawEmailPayload): Promise<RawSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = getEmailFromAddress();
  const to = Array.isArray(payload.to) ? payload.to : [payload.to];
  const replyTo = payload.replyTo?.trim() || getEmailReplyTo();

  if (!apiKey) {
    console.info("[email] dry-run (RESEND_API_KEY not set)", {
      from,
      to,
      subject: payload.subject,
      preview: payload.text.slice(0, 240),
      replyTo: replyTo ?? null,
    });
    return { ok: true, delivery: "simulated" };
  }

  const body: Record<string, unknown> = {
    from,
    to,
    subject: payload.subject,
    text: payload.text,
  };
  if (payload.html) body.html = payload.html;
  if (replyTo) body.reply_to = replyTo;
  if (payload.tags?.length) body.tags = payload.tags;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("[email] Resend send failed", res.status, detail);
      return { ok: false, delivery: "failed", message: `Resend ${res.status}: ${detail}` };
    }

    const data = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, delivery: "sent", providerId: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown send error";
    console.error("[email] Resend request error", message);
    return { ok: false, delivery: "failed", message };
  }
}
