/**
 * Lead Intake — the canonical pipeline.
 *
 *   Source Adapter → Normalize → Validate → Log Attempt → Abuse Check
 *     → Relationship Resolution → Lead Creation → Activity Logging
 *     → Automation Trigger → Assignment Hook → Notification
 *
 * Everything from Normalize onward lives here, exactly once. A Source
 * Adapter (the public inquiry form route, the tour-booking service, manual
 * entry, CSV import, the email parser, and any future source) supplies only
 * a RawIntakeInput and a `create` callback that calls its own source-
 * specific RPC (create_public_lead / book_tour / create_lead_atomic /
 * ingest_lead directly) — relationship resolution and lead creation
 * themselves live in the database's ingest_lead(), called by every one of
 * those RPCs; this function owns everything around that call.
 */
import { normalizeLeadInput } from "@/lib/lead-intake/normalize";
import { validateLeadInput } from "@/lib/lead-intake/validate";
import { logIntakeAttempt, markIntakeAttempt } from "@/lib/lead-intake/attempt-log";
import { checkRateLimit, isNearRateLimit } from "@/lib/lead-intake/rate-limit";
import { isTurnstileConfigured, verifyTurnstileToken } from "@/lib/lead-intake/turnstile";
import { resolveLeadOwner } from "@/lib/lead-intake/assignment";
import { triggerSequencesForRelationship } from "@/lib/message-sequences/service";
import type { IngestLeadOptions, IngestOutcome } from "@/lib/lead-intake/types";

const LOW_CONFIDENCE_THRESHOLD = 50;

export async function ingestLead(opts: IngestLeadOptions): Promise<IngestOutcome> {
  const normalized = normalizeLeadInput(opts.input);

  const attemptId = await logIntakeAttempt(opts.supabase, {
    venueId: opts.venueId,
    source: opts.source,
    trustTier: opts.trustTier,
    rawPayload: opts.rawPayload,
    normalizedPayload: normalized,
    ipAddress: opts.ipAddress ?? null,
  });

  const validation = validateLeadInput(normalized);
  if (!validation.ok) {
    await markIntakeAttempt(opts.supabase, attemptId, { status: "rejected_invalid", errorMessage: validation.error });
    return { ok: false, error: validation.error, attemptId };
  }

  if (opts.venueId && (opts.trustTier === "direct" || opts.trustTier === "email_parsed")) {
    const rateLimit = await checkRateLimit(opts.supabase, { venueId: opts.venueId, ipAddress: opts.ipAddress ?? null });
    if (!rateLimit.withinLimit) {
      await markIntakeAttempt(opts.supabase, attemptId, { status: "rejected_rate_limited", errorMessage: rateLimit.reason });
      return { ok: false, error: rateLimit.reason, attemptId };
    }

    // Turnstile — escalation only. Below the threshold a token is verified
    // if present but never required; at/above it, a missing or invalid
    // token is rejected the same way a rate-limit breach is.
    if (isTurnstileConfigured()) {
      const nearLimit = await isNearRateLimit(opts.supabase, { venueId: opts.venueId, ipAddress: opts.ipAddress ?? null });
      const turnstileOk = await verifyTurnstileToken(opts.turnstileToken ?? null, opts.ipAddress ?? null);
      if (nearLimit && !turnstileOk) {
        await markIntakeAttempt(opts.supabase, attemptId, { status: "rejected_rate_limited", errorMessage: "Verification required." });
        return { ok: false, error: "Please complete the verification challenge and try again.", attemptId };
      }
    }
  }

  const outcome = await opts.create(normalized);

  if (!outcome.ok) {
    await markIntakeAttempt(opts.supabase, attemptId, { status: "error", errorMessage: outcome.error });
    return { ...outcome, attemptId };
  }

  await markIntakeAttempt(opts.supabase, attemptId, {
    status: "accepted",
    leadId: outcome.leadId,
    relationshipId: outcome.relationshipId,
  });

  // Low-confidence email-parsed leads still create immediately (same Lead
  // object, same visibility as every other source) — but automation is
  // deliberately held until a coordinator confirms the extracted details,
  // since auto-messaging a couple from badly-parsed data is a real, distinct
  // risk a "please verify" banner alone doesn't cover.
  const shouldAutomate =
    opts.trustTier !== "email_parsed" || (normalized.confidenceScore ?? 100) >= LOW_CONFIDENCE_THRESHOLD;

  if (shouldAutomate) {
    try {
      const enrollmentIds = await triggerSequencesForRelationship(
        opts.supabase, opts.venueId!, outcome.relationshipId, "lead_created",
      );
      if (enrollmentIds.length) {
        await markIntakeAttempt(opts.supabase, attemptId, { status: "accepted", sequenceEnrollmentId: enrollmentIds[0] });
      }
    } catch (err) {
      console.error("Series enrollment (lead_created) failed:", err);
    }
  }

  await resolveLeadOwner(opts.supabase, outcome.leadId, opts.venueId!);

  return { ...outcome, attemptId };
}
