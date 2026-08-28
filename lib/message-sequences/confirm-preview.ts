/**
 * Resolved first-step preview for the existing pipeline → Automation confirm dialog.
 * Reuses the same merge path as Scheduled Sends (resolveForCustomerSend).
 * Informational only — never enrolls, sends, or mutates.
 */
import { createClient } from "@/integrations/supabase/server";
import { resolveForCustomerSend, type MergeContext } from "@/lib/message-templates/merge";
import { getSequenceWithSteps } from "@/lib/message-sequences/repository";
import { getMergeContextForRelationship } from "@/lib/scheduled-messages/repository";

type DbClient = Awaited<ReturnType<typeof createClient>>;

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

/**
 * Fetch a sequence's first step's template content + the relationship's
 * merge context, and resolve a preview — the DB-fetching counterpart to
 * resolveFirstStepPreview() above, for callers (the pipeline stage-move
 * confirm dialog) that only have IDs, not already-loaded content.
 */
export async function previewFirstStepForSequence(
  client: DbClient,
  venueId: string,
  sequenceId: string,
  relationshipId: string,
): Promise<AutomationMessagePreview | null> {
  const sequence = await getSequenceWithSteps(client, venueId, sequenceId);
  const firstStep = sequence?.steps[0];
  if (!firstStep) return null;

  const { data: template } = await client.from("message_templates")
    .select("email_subject, email_body, sms_body")
    .eq("id", firstStep.templateId)
    .maybeSingle<{ email_subject: string | null; email_body: string | null; sms_body: string | null }>();

  const mergeContext = await getMergeContextForRelationship(client, venueId, relationshipId);

  return resolveFirstStepPreview({
    channel: firstStep.channel,
    emailSubject: template?.email_subject ?? null,
    emailBody: template?.email_body ?? null,
    smsBody: template?.sms_body ?? null,
    mergeContext,
  });
}
