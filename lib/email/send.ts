/**
 * Email sending utility (Sprint 28).
 *
 * Uses the Resend API (https://resend.com) when RESEND_API_KEY is configured.
 * Falls back gracefully when no key is present — callers receive a mailto: URL
 * to open the user's native email client.
 *
 * All Resend POSTs go through shared/email/resend-http.ts so venue, shared,
 * and coordinated senders share distributed team-rate pacing (RESEND-SCALE).
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
import {
  classifyResendHttpFailure,
  formatResendLimitLogLine,
  type ResendFailureCode,
} from "@/lib/email/resend-failure";
import { parseRetryAfterSeconds } from "@/lib/email/retry-after";
import type { EmailSendCategory, EmailSendPriority } from "@shared/email/pacing/priority";
import { DEFAULT_SEND_CATEGORY, priorityForCategory } from "@shared/email/pacing/priority";
import { postResendEmail } from "@shared/email/resend-http";

export type EmailAttachment = {
  /** Public URL Resend can fetch (preferred for conversation uploads). */
  path?: string;
  /** Base64 content — used when path is unavailable. */
  content?: string;
  filename: string;
};

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;       // plain text body
  html?: string;      // optional rich HTML body
  replyTo?: string;   // venue contact email
  threadId?: string;  // when set, Reply-To routes through inbound for thread matching
  attachments?: EmailAttachment[];
  /** Inventory category — drives default priority when priority omitted. */
  category?: EmailSendCategory;
  priority?: EmailSendPriority;
  /** Resend Idempotency-Key (1–256 chars). Same key + payload within 24h → original response. */
  idempotencyKey?: string;
  tags?: Array<{ name: string; value: string }>;
  openTracking?: boolean;
  clickTracking?: boolean;
  userAgent?: string;
  /** Override pacing wait (ms). Bulk defaults to 0. */
  pacingMaxWaitMs?: number;
};

export type SendResult =
  | { ok: true; method: "resend" | "mailto" | "disabled"; providerId?: string; mailtoUrl?: string; sandboxRedirectedFrom?: string }
  | {
      ok: false;
      message: string;
      code?: ResendFailureCode | "disabled" | "misconfigured" | "capacity" | "pacing_unavailable";
      retryUnsafe?: boolean;
      /** Parsed from provider Retry-After when present (seconds). */
      retryAfterSeconds?: number;
    };

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Reply-To selection for outbound email.
 * When both threadId and RESEND_INBOUND_ADDRESS are set, replies route through
 * `thread+{conversationId}@…` for inbound matching. Otherwise venue replyTo.
 */
export function resolveSendEmailReplyTo(opts: {
  threadId?: string;
  replyTo?: string | null;
  inboundAddress?: string | null;
}): string | null {
  const inbound = opts.inboundAddress?.trim() || null;
  if (opts.threadId && inbound) {
    return `thread+${opts.threadId}@${inbound.replace(/^.*@/, "")}`;
  }
  return opts.replyTo ?? null;
}

export async function sendEmail(payload: EmailPayload): Promise<SendResult> {
  // Practice Run hard stop — never deliver to practice sample addresses.
  const { isPracticeSampleEmail, practiceSideEffectBlockedMessage } = await import(
    "@/lib/practice-run/isolation"
  );
  if (isPracticeSampleEmail(payload.to)) {
    return { ok: false, message: practiceSideEffectBlockedMessage("email") };
  }

  const mode = getCommunicationMode();
  if (mode === "disabled") {
    return { ok: false, message: "Sending is turned off in this environment." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL ?? "Hello to Cheers <onboarding@resend.dev>";

  let recipient = payload.to;
  let sandboxRedirectedFrom: string | undefined;
  if (mode === "sandbox") {
    const sandboxTo = sandboxEmailRecipient();
    if (!sandboxTo) {
      return {
        ok: false,
        message: "This environment isn't ready to send — the message was not delivered to a real recipient.",
      };
    }
    sandboxRedirectedFrom = payload.to;
    recipient = sandboxTo;
  }

  // --- Resend API path ---
  if (apiKey) {
    // Default uncategorized → bulk so omitted classification cannot steal
    // critical reserved capacity (RESEND-SCALE hardening).
    const category = payload.category ?? DEFAULT_SEND_CATEGORY;
    const priority = payload.priority ?? priorityForCategory(category);
    const body: Record<string, unknown> = {
      from: fromEmail,
      to: [recipient],
      subject: payload.subject,
      text: payload.text,
      // Enable delivery + engagement tracking so signals flow back into Hello to Cheers
      // via the /api/messaging/webhook route. These fire email.opened and
      // email.clicked events which become lead_signal_events entries.
      open_tracking: payload.openTracking ?? true,
      click_tracking: payload.clickTracking ?? true,
    };
    if (payload.html) body.html = payload.html;
    // Reply-To: route through inbound address if configured, otherwise venue email
    const replyTo = resolveSendEmailReplyTo({
      threadId: payload.threadId,
      replyTo: payload.replyTo,
      inboundAddress: process.env.RESEND_INBOUND_ADDRESS,
    });
    if (replyTo) body.reply_to = replyTo;
    if (payload.attachments && payload.attachments.length > 0) {
      body.attachments = payload.attachments.map((a) => {
        const item: Record<string, string> = { filename: a.filename };
        if (a.path) item.path = a.path;
        else if (a.content) item.content = a.content;
        return item;
      });
    }
    if (payload.tags?.length) body.tags = payload.tags;

    const posted = await postResendEmail({
      apiKey,
      body,
      category,
      priority,
      idempotencyKey: payload.idempotencyKey,
      userAgent: payload.userAgent,
      maxWaitMs: payload.pacingMaxWaitMs,
    });

    if (!posted.ok) {
      if (posted.kind === "pacing") {
        if (posted.code === "capacity") {
          console.warn(formatResendLimitLogLine("rate_limit", 429));
        }
        return {
          ok: false,
          message: posted.message,
          code: posted.code,
          retryUnsafe: posted.retryUnsafe,
          retryAfterSeconds: posted.retryAfterSeconds,
        };
      }
      if (posted.kind === "network") {
        return {
          ok: false,
          message: posted.message,
          code: "temporary",
          retryUnsafe: false,
        };
      }
      const classified = classifyResendHttpFailure({
        status: posted.status,
        bodyText: posted.bodyText,
      });
      if (classified.code === "quota" || classified.code === "rate_limit") {
        console.warn(formatResendLimitLogLine(classified.code, posted.status));
      }
      const retryAfterSeconds =
        parseRetryAfterSeconds(posted.retryAfterHeader) ?? undefined;
      return {
        ok: false,
        message: classified.message,
        code: classified.code,
        retryUnsafe: classified.retryUnsafe,
        retryAfterSeconds,
      };
    }

    return {
      ok: true,
      method: "resend",
      providerId: posted.providerId,
      sandboxRedirectedFrom,
    };
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
