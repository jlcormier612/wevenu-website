/**
 * Enroll relationships into Automations from Platform Events.
 * Invoked by the automation cron alongside rule evaluation.
 *
 * Idempotency:
 * - platform_event_automation_scans — each event is considered once
 * - sequence_platform_event_claims — each (event, automation) enrolls at most once
 * - hasActiveEnrollment — skip when already mid-flight
 */
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  isSupportedAutomationPlatformEvent,
  sequenceTriggerForPlatformEvent,
} from "@/lib/message-sequences/platform-triggers";
import * as repo from "@/lib/message-sequences/repository";
import type { SequenceTriggerType } from "@/lib/message-sequences/types";

const BATCH_SIZE = 50;

export type PlatformEnrollmentResult = {
  scanned: number;
  enrolled: number;
  skipped: number;
  failed: number;
};

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for sequence platform enrollments.");
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

type PlatformEventRow = {
  id: string;
  event_type: string;
  venue_id: string;
  client_id: string | null;
  entity_type: string;
  entity_id: string;
};

async function resolveRelationshipId(
  client: SupabaseClient,
  event: PlatformEventRow,
): Promise<string | null> {
  if (event.client_id) {
    const { data } = await client.from("clients")
      .select("relationship_id")
      .eq("id", event.client_id)
      .maybeSingle<{ relationship_id: string | null }>();
    if (data?.relationship_id) return data.relationship_id;
  }

  if (event.entity_type === "contract") {
    const { data } = await client.from("contracts")
      .select("client_id")
      .eq("id", event.entity_id)
      .maybeSingle<{ client_id: string | null }>();
    if (!data?.client_id) return null;
    const { data: clientRow } = await client.from("clients")
      .select("relationship_id")
      .eq("id", data.client_id)
      .maybeSingle<{ relationship_id: string | null }>();
    return clientRow?.relationship_id ?? null;
  }

  if (event.entity_type === "event") {
    const { data } = await client.from("events")
      .select("client_id")
      .eq("id", event.entity_id)
      .maybeSingle<{ client_id: string | null }>();
    if (!data?.client_id) return null;
    const { data: clientRow } = await client.from("clients")
      .select("relationship_id")
      .eq("id", data.client_id)
      .maybeSingle<{ relationship_id: string | null }>();
    return clientRow?.relationship_id ?? null;
  }

  if (event.entity_type === "questionnaire") {
    const { data } = await client.from("event_questionnaires")
      .select("event_id")
      .eq("id", event.entity_id)
      .maybeSingle<{ event_id: string }>();
    if (!data?.event_id) return null;
    const { data: ev } = await client.from("events")
      .select("client_id")
      .eq("id", data.event_id)
      .maybeSingle<{ client_id: string | null }>();
    if (!ev?.client_id) return null;
    const { data: clientRow } = await client.from("clients")
      .select("relationship_id")
      .eq("id", ev.client_id)
      .maybeSingle<{ relationship_id: string | null }>();
    return clientRow?.relationship_id ?? null;
  }

  return null;
}

async function tryClaim(
  client: SupabaseClient,
  platformEventId: string,
  sequenceId: string,
): Promise<boolean> {
  const { error } = await client.from("sequence_platform_event_claims").insert({
    platform_event_id: platformEventId,
    sequence_id: sequenceId,
    enrollment_id: null,
  });
  if (error) {
    if (error.code === "23505") return false;
    throw error;
  }
  return true;
}

async function markScanned(client: SupabaseClient, platformEventId: string): Promise<void> {
  const { error } = await client.from("platform_event_automation_scans").insert({
    platform_event_id: platformEventId,
    scanned_at: new Date().toISOString(),
  });
  if (error && error.code !== "23505") throw error;
}

export async function processSequenceEnrollmentsFromPlatformEvents(): Promise<PlatformEnrollmentResult> {
  const client = getServiceClient();
  const result: PlatformEnrollmentResult = { scanned: 0, enrolled: 0, skipped: 0, failed: 0 };

  const { data: events, error } = await client.rpc("list_unscanned_automation_platform_events", {
    p_limit: BATCH_SIZE,
  });

  if (error) throw error;
  if (!events || events.length === 0) return result;

  for (const row of events as PlatformEventRow[]) {
    if (!isSupportedAutomationPlatformEvent(row.event_type)) {
      await markScanned(client, row.id);
      continue;
    }
    const triggerType = sequenceTriggerForPlatformEvent(row.event_type) as SequenceTriggerType;
    result.scanned++;

    try {
      const relationshipId = await resolveRelationshipId(client, row);
      if (!relationshipId) {
        result.skipped++;
        await markScanned(client, row.id);
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sequences = await repo.getActiveSequencesForTrigger(client as any, row.venue_id, triggerType);
      for (const seq of sequences) {
        const claimed = await tryClaim(client, row.id, seq.id);
        if (!claimed) {
          result.skipped++;
          continue;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (await repo.hasActiveEnrollment(client as any, seq.id, relationshipId)) {
          result.skipped++;
          continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const enrollmentId = await repo.insertEnrollment(client as any, row.venue_id, seq.id, relationshipId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await repo.materializeEnrollmentSteps(client as any, row.venue_id, enrollmentId, seq.id, relationshipId);
        await client.from("sequence_platform_event_claims")
          .update({ enrollment_id: enrollmentId })
          .eq("platform_event_id", row.id)
          .eq("sequence_id", seq.id);
        result.enrolled++;
      }

      await markScanned(client, row.id);
    } catch (e) {
      console.error("[automations] platform enrollment failed:", row.id, e);
      result.failed++;
    }
  }

  return result;
}
