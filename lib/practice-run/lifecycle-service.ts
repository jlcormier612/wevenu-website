/**
 * PM-05 — Practice Run finish + reset/cleanup.
 * Honors practice_runs status model: in_progress → resetting → archived.
 * Never mutates permanent venue config, templates, branding, or non-practice CRM.
 */

import { createClient } from "@/integrations/supabase/server";
import { findVenueCoupleConversationId } from "@/lib/conversations/venue-couple-conversation";
import { isSupabaseConfigured } from "@/lib/env";
import { emptyPracticeJourney } from "@/lib/practice-run/journey";
import * as practiceRepo from "@/lib/practice-run/repository";
import { createSampleWedding } from "@/lib/practice-run/sample-wedding";
import {
  PRACTICE_FINISH_COPY,
} from "@/lib/practice-run/lifecycle-copy";
import {
  PRACTICE_CELEBRATION_NAME,
  type PracticeRun,
} from "@/lib/practice-run/types";
import { getCurrentVenue } from "@/lib/venue/service";

export { PRACTICE_FINISH_COPY, PRACTICE_RESET_CONFIRM_COPY } from "@/lib/practice-run/lifecycle-copy";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

async function requireVenueStaffContext(): Promise<
  | { ok: true; client: Awaited<ReturnType<typeof createClient>>; venueId: string; userId: string | null }
  | { ok: false; message: string }
> {
  if (!isSupabaseConfigured) return { ok: false, message: "Hello to Cheers is not connected." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Choose a venue to continue." };
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  return { ok: true, client, venueId: venue.id, userId: auth.user?.id ?? null };
}

async function deleteByEvent(
  client: DbClient,
  table: string,
  venueId: string,
  eventId: string,
): Promise<number> {
  const { data, error } = await client
    .from(table)
    .delete()
    .eq("venue_id", venueId)
    .eq("event_id", eventId)
    .select("id");
  if (error) {
    // Table may not exist for every venue configuration — ignore soft failures.
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("column")) {
      return 0;
    }
    // Some tables lack venue_id — try event_id only.
    const retry = await client.from(table).delete().eq("event_id", eventId).select("id");
    if (retry.error) return 0;
    return (retry.data ?? []).length;
  }
  return (data ?? []).length;
}

async function deleteByClient(
  client: DbClient,
  table: string,
  venueId: string,
  clientId: string,
): Promise<number> {
  const { data, error } = await client
    .from(table)
    .delete()
    .eq("venue_id", venueId)
    .eq("client_id", clientId)
    .select("id");
  if (error) {
    const retry = await client.from(table).delete().eq("client_id", clientId).select("id");
    if (retry.error) return 0;
    return (retry.data ?? []).length;
  }
  return (data ?? []).length;
}

/**
 * Remove practice-only planning / portal artifacts for a sample celebration.
 * Does not touch permanent templates or non-practice CRM rows.
 */
export async function cleanupPracticeSampleArtifacts(
  client: DbClient,
  venueId: string,
  run: PracticeRun,
): Promise<{
  deleted: Record<string, number>;
}> {
  const deleted: Record<string, number> = {};
  const eventId = run.sampleEventId;
  const clientId = run.sampleClientId;

  if (eventId) {
    for (const table of [
      "event_tasks",
      "timeline_entries",
      "event_questionnaires",
      "event_playbook_applications",
      "event_orders",
      "event_inventory",
      "event_floor_plans",
      "floor_plans",
    ] as const) {
      deleted[table] = await deleteByEvent(client, table, venueId, eventId);
    }
  }

  if (clientId) {
    deleted.documents = await deleteByClient(client, "documents", venueId, clientId);
    deleted.couple_websites = await deleteByClient(client, "couple_websites", venueId, clientId);
    const { data: sessions } = await client
      .from("client_portal_sessions")
      .delete()
      .eq("client_id", clientId)
      .ilike("label", "Practice Run client view%")
      .select("id");
    deleted.client_portal_sessions = (sessions ?? []).length;
  }

  if (run.sampleRelationshipId) {
    const conversationId = await findVenueCoupleConversationId(client, run.sampleRelationshipId);
    if (conversationId) {
      const { data: msgs } = await client
        .from("conversation_messages")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("channel", "portal")
        .select("id");
      deleted.conversation_messages = (msgs ?? []).length;
    }
  }

  return { deleted };
}

/**
 * Soft-retain sample Lead/Client/Event under an archived run (reporting-excluded).
 * Prefer hard delete when FK-safe; otherwise leave linked to archived practice_run_id.
 */
async function archiveSampleCrmRows(
  client: DbClient,
  venueId: string,
  run: PracticeRun,
): Promise<{ eventsDeleted: boolean; clientsDeleted: boolean; leadsDeleted: boolean }> {
  let eventsDeleted = false;
  let clientsDeleted = false;
  let leadsDeleted = false;

  if (run.sampleEventId) {
    const { error } = await client
      .from("events")
      .delete()
      .eq("venue_id", venueId)
      .eq("id", run.sampleEventId)
      .eq("practice_run_id", run.id);
    if (!error) eventsDeleted = true;
    else {
      await client
        .from("events")
        .update({
          exclude_from_business_reporting: true,
          practice_run_id: run.id,
        })
        .eq("venue_id", venueId)
        .eq("id", run.sampleEventId);
    }
  }

  if (run.sampleClientId) {
    const { error } = await client
      .from("clients")
      .delete()
      .eq("venue_id", venueId)
      .eq("id", run.sampleClientId)
      .eq("practice_run_id", run.id);
    if (!error) clientsDeleted = true;
    else {
      await client
        .from("clients")
        .update({
          exclude_from_business_reporting: true,
          practice_run_id: run.id,
        })
        .eq("venue_id", venueId)
        .eq("id", run.sampleClientId);
    }
  }

  if (run.sampleLeadId) {
    const { error } = await client
      .from("leads")
      .delete()
      .eq("venue_id", venueId)
      .eq("id", run.sampleLeadId)
      .eq("practice_run_id", run.id);
    if (!error) leadsDeleted = true;
    else {
      await client
        .from("leads")
        .update({
          exclude_from_business_reporting: true,
          practice_run_id: run.id,
        })
        .eq("venue_id", venueId)
        .eq("id", run.sampleLeadId);
    }
  }

  return { eventsDeleted, clientsDeleted, leadsDeleted };
}

/**
 * Finish Practice Run for now — keep the active run for Continue later.
 * Does not delete samples or change permanent venue configuration.
 */
export async function finishPracticeRun(runId: string): Promise<
  | { ok: true; run: PracticeRun; message: string }
  | { ok: false; message: string }
> {
  const ctx = await requireVenueStaffContext();
  if (!ctx.ok) return ctx;
  const run = await practiceRepo.getPracticeRunForVenue(ctx.client, ctx.venueId, runId);
  if (!run || run.status !== "in_progress") {
    return { ok: false, message: "Practice Run not found for this venue." };
  }
  const journey = {
    ...run.journey,
    finishedAt: new Date().toISOString(),
  };
  const updated = await practiceRepo.updatePracticeJourney(ctx.client, ctx.venueId, run.id, journey);
  return {
    ok: true,
    run: updated,
    message: PRACTICE_FINISH_COPY.body,
  };
}

/**
 * Reset Practice Run: archive current samples, clean artifacts, start a fresh run.
 * Idempotent under the one-active-per-venue constraint.
 */
export async function resetPracticeRun(runId: string): Promise<
  | { ok: true; run: PracticeRun; previousRunId: string; message: string; cleanup: Record<string, number> }
  | { ok: false; message: string }
> {
  const ctx = await requireVenueStaffContext();
  if (!ctx.ok) return ctx;
  const { client, venueId, userId } = ctx;

  const existing = await practiceRepo.getPracticeRunForVenue(client, venueId, runId);
  if (!existing || (existing.status !== "in_progress" && existing.status !== "resetting")) {
    return { ok: false, message: "Practice Run not found for this venue." };
  }

  await practiceRepo.setPracticeRunStatus(client, venueId, existing.id, "resetting");

  const { deleted } = await cleanupPracticeSampleArtifacts(client, venueId, existing);
  await archiveSampleCrmRows(client, venueId, existing);

  // Clear sample pointers on the archived row so a new run is the only active path.
  await client
    .from("practice_runs")
    .update({
      status: "archived",
      journey: emptyPracticeJourney(),
      practice_booked_at: null,
      sample_lead_id: null,
      sample_client_id: null,
      sample_event_id: null,
      sample_relationship_id: null,
    })
    .eq("venue_id", venueId)
    .eq("id", existing.id);

  let fresh = await practiceRepo.insertPracticeRun(
    client,
    venueId,
    PRACTICE_CELEBRATION_NAME,
    userId,
  );
  fresh = await createSampleWedding(client, venueId, fresh);

  return {
    ok: true,
    run: fresh,
    previousRunId: existing.id,
    cleanup: deleted,
    message:
      "Your Practice Run is ready again — a fresh Maya & Jordan celebration, with your real venue settings untouched.",
  };
}
