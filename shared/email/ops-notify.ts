/**
 * Ops-only internal alerts (subscription purchase, White Glove intake).
 * Uses INQUIRY_NOTIFY_EMAIL + sendRawEmail. Never timeline'd. Never attaches files.
 */

import { sendRawEmail } from "./client";
import type { RawSendResult } from "./types";

export function resolveInquiryNotifyEmail(): string | null {
  const to = process.env.INQUIRY_NOTIFY_EMAIL?.trim() || "";
  return to || null;
}

export type OpsNotifyResult =
  | { ok: true; delivery: "sent" | "simulated" | "skipped"; providerId?: string; to?: string }
  | { ok: false; delivery: "failed"; message: string; to?: string };

/**
 * Send an ops-only email. When INQUIRY_NOTIFY_EMAIL is unset, logs and skips
 * (ok: true, delivery: "skipped") so callers do not fail customer flows.
 */
export async function sendOpsInternalEmail(input: {
  subject: string;
  text: string;
  idempotencyKey?: string;
  tags?: Array<{ name: string; value: string }>;
}): Promise<OpsNotifyResult> {
  const to = resolveInquiryNotifyEmail();
  if (!to) {
    console.info(
      `[ops-notify] skipped (INQUIRY_NOTIFY_EMAIL not set)\n${input.subject}\n${input.text}`,
    );
    return { ok: true, delivery: "skipped" };
  }

  const result: RawSendResult = await sendRawEmail({
    to,
    subject: input.subject,
    text: input.text,
    idempotencyKey: input.idempotencyKey,
    tags: input.tags,
  });

  if (!result.ok) {
    console.error("[ops-notify] send failed", result.message);
    return { ok: false, delivery: "failed", message: result.message, to };
  }
  if (result.delivery === "simulated") {
    console.info(`[ops-notify] dry-run → ${to}\n${input.subject}\n${input.text.slice(0, 400)}`);
  }
  return {
    ok: true,
    delivery: result.delivery,
    providerId: result.providerId,
    to,
  };
}
