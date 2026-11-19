/**
 * Single Resend POST entry used by venue + shared + (conceptually) ops.
 * Always acquires a distributed pacing slot before calling the provider.
 */

import {
  acquireResendSendSlot,
  type PacingAcquireFail,
} from "./pacing/acquire";
import type { EmailSendCategory, EmailSendPriority } from "./pacing/priority";
import { priorityForCategory } from "./pacing/priority";

export type ResendHttpBody = Record<string, unknown>;

export type ResendHttpRequest = {
  apiKey: string;
  body: ResendHttpBody;
  category: EmailSendCategory;
  /** Override derived priority when a caller must force critical/bulk. */
  priority?: EmailSendPriority;
  idempotencyKey?: string;
  userAgent?: string;
  /**
   * Bulk default 0 (no wait). Critical default handled in acquireResendSendSlot.
   */
  maxWaitMs?: number;
};

export type ResendHttpSuccess = {
  ok: true;
  status: number;
  providerId?: string;
  headers: Headers;
  bodyText: string;
};

export type ResendHttpFailure =
  | {
      ok: false;
      kind: "pacing";
      code: PacingAcquireFail["code"];
      message: string;
      retryAfterSeconds?: number;
      retryUnsafe: boolean;
    }
  | {
      ok: false;
      kind: "http";
      status: number;
      bodyText: string;
      headers: Headers;
      retryAfterHeader: string | null;
    }
  | {
      ok: false;
      kind: "network";
      message: string;
    };

export type ResendHttpResult = ResendHttpSuccess | ResendHttpFailure;

export async function postResendEmail(req: ResendHttpRequest): Promise<ResendHttpResult> {
  const priority = req.priority ?? priorityForCategory(req.category);
  const maxWaitMs =
    req.maxWaitMs ??
    (priority === "bulk" ? 0 : undefined);

  const slot = await acquireResendSendSlot({ priority, maxWaitMs });
  if (!slot.ok) {
    return {
      ok: false,
      kind: "pacing",
      code: slot.code,
      message: slot.message,
      retryAfterSeconds: slot.retryAfterSeconds,
      retryUnsafe: slot.retryUnsafe,
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${req.apiKey}`,
        "Content-Type": "application/json",
        ...(req.userAgent ? { "User-Agent": req.userAgent } : {}),
        ...(req.idempotencyKey?.trim()
          ? { "Idempotency-Key": req.idempotencyKey.trim().slice(0, 256) }
          : {}),
      },
      body: JSON.stringify(req.body),
    });

    const bodyText = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        kind: "http",
        status: res.status,
        bodyText,
        headers: res.headers,
        retryAfterHeader: res.headers.get("retry-after"),
      };
    }

    let providerId: string | undefined;
    try {
      const parsed = JSON.parse(bodyText) as { id?: string };
      providerId = parsed?.id;
    } catch {
      providerId = undefined;
    }

    return {
      ok: true,
      status: res.status,
      providerId,
      headers: res.headers,
      bodyText,
    };
  } catch (err) {
    return {
      ok: false,
      kind: "network",
      message: err instanceof Error ? err.message : "Unknown send error",
    };
  }
}
