/**
 * Facebook Lead Ads queue processor. Mirrors lib/quickbooks/processor.ts's
 * shape exactly: admin client, atomic claim, connection-level circuit
 * breaker, dispatch, backoff/dead-letter on failure.
 *
 * Instant Forms on Facebook and Instagram both arrive as Page `leadgen`
 * events. Placement is taken from Meta's `platform` field on the lead
 * object (`ig` vs `fb`), not guessed from the Page having Instagram linked.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import * as repo from "@/lib/facebook/repository";
import { computeNextAttemptAt, MAX_ATTEMPTS } from "@/lib/facebook/backoff";
import { facebookFetch } from "@/lib/facebook/client";
import {
  LEADGEN_FETCH_FIELDS_MINIMAL,
  META_INTAKE_SOURCE,
  type GraphLeadPayload,
  leadgenFetchPath,
  mapGraphLeadToIntake,
} from "@/lib/facebook/lead-mapping";
import { ingestLead } from "@/lib/lead-intake/pipeline";

const BATCH_SIZE = 50;

export type ProcessResult = { processed: number; succeeded: number; failedRetrying: number; deadLettered: number; skipped: number };

async function fetchGraphLead(venueId: string, leadgenId: string): Promise<
  | { ok: true; data: GraphLeadPayload }
  | { ok: false; error: string; retryable: boolean }
> {
  const full = await facebookFetch(venueId, leadgenFetchPath(leadgenId));
  if (full.ok) {
    const data = await full.response.json() as GraphLeadPayload;
    return { ok: true, data };
  }
  // Ads metadata fields can 400 without ads_read; field_data still works
  // with leads_retrieval. Retry the minimal set before treating as failure.
  if (!full.retryable) {
    const minimal = await facebookFetch(venueId, leadgenFetchPath(leadgenId, LEADGEN_FETCH_FIELDS_MINIMAL));
    if (minimal.ok) {
      const data = await minimal.response.json() as GraphLeadPayload;
      return { ok: true, data };
    }
    return minimal;
  }
  return full;
}

export async function processFacebookLeadQueue(): Promise<ProcessResult> {
  const admin = createAdminClient();
  const result: ProcessResult = { processed: 0, succeeded: 0, failedRetrying: 0, deadLettered: 0, skipped: 0 };

  await repo.reclaimStaleProcessing(admin);

  const batch = await repo.getDueBatch(admin, BATCH_SIZE);

  for (const item of batch) {
    const claimed = await repo.claimQueueItem(admin, item.id);
    if (!claimed) continue;
    result.processed++;

    const connection = await repo.getConnection(admin, item.venue_id);
    if (!connection || connection.status !== "connected") {
      await repo.releaseQueueItem(admin, item.id);
      result.skipped++;
      continue;
    }

    const fetchResult = await fetchGraphLead(item.venue_id, item.leadgen_id);
    if (!fetchResult.ok) {
      await handleFailure(admin, item, fetchResult.error, fetchResult.retryable);
      if (!fetchResult.retryable || item.attempt_count + 1 >= item.max_attempts) result.deadLettered++; else result.failedRetrying++;
      continue;
    }

    const data = fetchResult.data;
    if (!data.field_data) {
      // A 404-shaped "lead no longer exists" (the submitter deleted their
      // own lead on Meta's side before we processed it) surfaces as a
      // successful HTTP response with no field_data — non-retryable,
      // there's nothing that will ever succeed here.
      await handleFailure(admin, item, data.error?.message ?? "Lead no longer exists on Facebook.", false);
      result.deadLettered++;
      continue;
    }

    const mapped = mapGraphLeadToIntake(data, {
      leadgenId: item.leadgen_id,
      formId: item.form_id,
      pageId: item.page_id,
    });
    const outcome = await ingestLead({
      supabase: admin,
      venueId: item.venue_id,
      source: META_INTAKE_SOURCE,
      trustTier: "webhook",
      rawPayload: data,
      input: mapped.input,
      externalRef: item.leadgen_id,
      create: async (n) => {
        const { data: rpcData, error } = await admin.rpc("ingest_lead", {
          p_venue_id: item.venue_id,
          p_source: mapped.leadSource,
          p_input: {
            firstName: n.firstName, lastName: n.lastName, email: n.email, phone: n.phone,
            eventType: n.eventType, eventDate: n.eventDate, guestCount: n.guestCount, sourceData: n.sourceData,
          },
        });
        if (error || !rpcData?.ok) return { ok: false, error: rpcData?.error ?? error?.message ?? "Could not create lead from this Facebook lead." };
        return { ok: true, leadId: rpcData.leadId as string, relationshipId: rpcData.relationshipId as string, isReturningRelationship: rpcData.isReturningRelationship === true };
      },
    });

    if (!outcome.ok) {
      await handleFailure(admin, item, outcome.error ?? "Lead creation failed.", true);
      if (item.attempt_count + 1 >= item.max_attempts) result.deadLettered++; else result.failedRetrying++;
      continue;
    }

    await repo.markQueueSucceeded(admin, item.id);
    await repo.insertLog(admin, { venueId: item.venue_id, queueId: item.id, leadgenId: item.leadgen_id, outcome: "succeeded", attemptNumber: item.attempt_count + 1, leadId: outcome.leadId });
    await repo.recordHealthCheck(admin, item.venue_id, true);
    result.succeeded++;
  }

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleFailure(admin: any, item: repo.FacebookQueueRow, error: string, retryable: boolean): Promise<void> {
  const nextAttemptCount = item.attempt_count + 1;
  const maxAttempts = item.max_attempts ?? MAX_ATTEMPTS;
  const isDeadLetter = !retryable || nextAttemptCount >= maxAttempts;

  if (isDeadLetter) {
    await repo.markQueueDeadLetter(admin, item.id, nextAttemptCount, error);
    await repo.insertLog(admin, { venueId: item.venue_id, queueId: item.id, leadgenId: item.leadgen_id, outcome: "dead_lettered", attemptNumber: nextAttemptCount, message: error });
  } else {
    await repo.markQueueFailedRetrying(admin, item.id, nextAttemptCount, computeNextAttemptAt(nextAttemptCount), error);
    await repo.insertLog(admin, { venueId: item.venue_id, queueId: item.id, leadgenId: item.leadgen_id, outcome: "failed", attemptNumber: nextAttemptCount, message: error });
  }
  await repo.recordHealthCheck(admin, item.venue_id, false, error);
}
