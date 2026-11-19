/**
 * Resend transport for Hello to Cheers product + ops email.
 *
 * Env (preferred):
 *   RESEND_API_KEY
 *   EMAIL_FROM          e.g. "Hello to Cheers <hello@hellotocheers.com>"
 *   EMAIL_REPLY_TO      optional default Reply-To
 *   RESEND_INBOUND_ADDRESS — inbound catch-all (e.g. inbox@replies.hellotocheers.com)
 *     When set, relationship sends use Reply-To relationship+{id}@domain
 *
 * Back-compat aliases (marketing ops notify already used these):
 *   FROM_EMAIL  → same as EMAIL_FROM
 *   RELATIONSHIP_INBOUND_ADDRESS → same as RESEND_INBOUND_ADDRESS
 *
 * All live POSTs go through resend-http.ts (distributed pacing).
 */

import type { EmailSendCategory, EmailSendPriority } from "./pacing/priority";
import { DEFAULT_SEND_CATEGORY, priorityForCategory } from "./pacing/priority";
import { postResendEmail } from "./resend-http";
import type { RawSendResult } from "./types";

export type RawEmailPayload = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  /** Optional tags for Resend dashboard filtering */
  tags?: Array<{ name: string; value: string }>;
  /**
   * Resend Idempotency-Key. Same key + same payload within 24h returns the
   * original email instead of sending another.
   */
  idempotencyKey?: string;
  category?: EmailSendCategory;
  priority?: EmailSendPriority;
  pacingMaxWaitMs?: number;
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

/** Domain used for Resend inbound routing / subaddress Reply-To. */
export function getInboundEmailDomain(): string | undefined {
  const addr =
    process.env.RESEND_INBOUND_ADDRESS?.trim() ||
    process.env.RELATIONSHIP_INBOUND_ADDRESS?.trim() ||
    "";
  if (!addr) return undefined;
  return addr.includes("@") ? addr.replace(/^.*@/, "") : addr;
}

/**
 * Prefer Reply-To `relationship+{id}@inbound-domain` so inbound replies
 * match without relying on From-email uniqueness.
 */
export function buildRelationshipReplyTo(
  relationshipId: string,
): string | undefined {
  const domain = getInboundEmailDomain();
  const id = relationshipId.trim().replace(/[^a-zA-Z0-9_+-]/g, "");
  if (!domain || !id) return undefined;
  return `relationship+${id}@${domain}`;
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

  const category = payload.category ?? DEFAULT_SEND_CATEGORY;
  const priority = payload.priority ?? priorityForCategory(category);
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
    const posted = await postResendEmail({
      apiKey,
      body,
      category,
      priority,
      idempotencyKey: payload.idempotencyKey,
      maxWaitMs: payload.pacingMaxWaitMs,
    });

    if (!posted.ok) {
      if (posted.kind === "pacing") {
        console.error("[email] pacing blocked send", posted.code, posted.message);
        return { ok: false, delivery: "failed", message: posted.message };
      }
      if (posted.kind === "network") {
        console.error("[email] Resend request error", posted.message);
        return { ok: false, delivery: "failed", message: posted.message };
      }
      console.error("[email] Resend send failed", posted.status, posted.bodyText);
      return {
        ok: false,
        delivery: "failed",
        message: `Resend ${posted.status}: ${posted.bodyText}`,
      };
    }

    return { ok: true, delivery: "sent", providerId: posted.providerId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown send error";
    console.error("[email] Resend request error", message);
    return { ok: false, delivery: "failed", message };
  }
}
