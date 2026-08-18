/**
 * Shared plumbing for Resend's inbound-email webhook model, used by both
 * app/api/leads/email-intake/route.ts (new-lead origination) and
 * app/api/messaging/inbound/route.ts (reply-threading) — the two routes
 * are deliberately separate systems (see each route's own doc comment for
 * why), but they consume the identical Resend webhook envelope, signature
 * scheme, and body-retrieval call, so that part lives here once.
 *
 * Verified directly against Resend's own current docs (2026-08):
 *
 * - The `email.received` webhook payload is metadata only — no body, no
 *   headers, no attachments. Shape: {type, created_at, data: {email_id,
 *   from, to, subject, cc, bcc, received_for, message_id, attachments}}.
 * - The actual text/html body and raw headers require a follow-up
 *   GET /emails/receiving/{email_id} call (Bearer auth). Its `headers`
 *   field is a lowercase-keyed object map (e.g. {"in-reply-to": "..."}),
 *   not an array — a real mismatch from what earlier code here assumed.
 * - Signatures are Svix-based (svix-id / svix-timestamp / svix-signature
 *   headers), not a query-string secret. signedContent =
 *   "{svix-id}.{svix-timestamp}.{rawBody}"; secret is the base64 portion
 *   after stripping "whsec_"; signature is base64(HMAC-SHA256(secret,
 *   signedContent)); svix-signature may carry multiple space-separated
 *   "v1,<sig>" candidates for key rotation — any match is valid.
 *
 * Implemented directly with node:crypto rather than the svix package, and
 * with a raw fetch() rather than the resend SDK — matching this
 * codebase's existing pattern (shared/email/client.ts never uses either).
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type ResendInboundWebhookEvent = {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject?: string;
    message_id?: string;
    cc?: string[];
    bcc?: string[];
    received_for?: string[];
  };
};

export type SvixHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

export function verifySvixSignature(rawBody: string, headers: SvixHeaders, secret: string): boolean {
  if (!headers.id || !headers.timestamp || !headers.signature) return false;
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  const candidates = headers.signature.split(" ").map((c) => c.split(",")[1]).filter(Boolean);
  return candidates.some((candidate) => {
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(candidate);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

export type ReceivedEmailContent = {
  text: string;
  html: string;
  /** Lowercase header name -> value, per Resend's actual response shape. */
  headers: Record<string, string>;
};

/** Fetches the actual body/headers for a received email — never present in the webhook payload itself. */
export async function fetchReceivedEmailContent(emailId: string): Promise<ReceivedEmailContent | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      console.warn("Resend inbound: could not retrieve received email content:", res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as { text?: string | null; html?: string | null; headers?: Record<string, string> };
    return { text: data.text ?? "", html: data.html ?? "", headers: data.headers ?? {} };
  } catch (err) {
    console.warn("Resend inbound: retrieve request failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export function findHeaderValue(headers: Record<string, string>, name: string): string | null {
  return headers[name.toLowerCase()] ?? null;
}

export function htmlToText(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}
