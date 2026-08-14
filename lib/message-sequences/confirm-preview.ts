/**
 * Resolved first-step preview for the existing pipeline → Automation confirm dialog.
 * Reuses the same merge path as Scheduled Sends (resolveForCustomerSend).
 * Informational only — never enrolls, sends, or mutates.
 */
import { resolveForCustomerSend, type MergeContext } from "@/lib/message-templates/merge";

export type AutomationMessagePreview =
  | { ok: true; channel: "email" | "sms"; subject: string | null; body: string }
  | { ok: false; fallback: string };

const PREVIEW_UNAVAILABLE = "Message preview unavailable.";

/**
 * Build a display preview from template content + the same MergeContext the
 * processor would use at send time. On unresolved merge tokens (or missing
 * content), return a truthful minimal fallback — never invent message text.
 */
export function resolveFirstStepPreview(opts: {
  channel: "email" | "sms";
  emailSubject: string | null;
  emailBody: string | null;
  smsBody: string | null;
  mergeContext: MergeContext | null;
}): AutomationMessagePreview {
  const body = opts.channel === "email" ? (opts.emailBody ?? "") : (opts.smsBody ?? "");
  const subject = opts.channel === "email" ? (opts.emailSubject ?? "") : null;

  if (!body.trim() && !(subject && subject.trim())) {
    return { ok: false, fallback: PREVIEW_UNAVAILABLE };
  }

  if (!opts.mergeContext) {
    return { ok: false, fallback: PREVIEW_UNAVAILABLE };
  }

  const resolved = resolveForCustomerSend(body, subject, opts.mergeContext);
  if (!resolved.ok) {
    return { ok: false, fallback: PREVIEW_UNAVAILABLE };
  }

  return {
    ok: true,
    channel: opts.channel,
    subject: opts.channel === "email" ? resolved.subject : null,
    body: resolved.body,
  };
}

export { PREVIEW_UNAVAILABLE as AUTOMATION_PREVIEW_UNAVAILABLE };
