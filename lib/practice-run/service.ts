import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as practiceRepo from "@/lib/practice-run/repository";
import { createSampleWedding } from "@/lib/practice-run/sample-wedding";
import {
  PRACTICE_CELEBRATION_NAME,
  type PracticeRun,
  type PracticeRunStartResult,
} from "@/lib/practice-run/types";
import { getCurrentVenue } from "@/lib/venue/service";

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

export async function getActivePracticeRunForCurrentVenue(): Promise<PracticeRun | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const client = await createClient();
  return practiceRepo.getActivePracticeRun(client, venue.id);
}

/**
 * Start a new Practice Run or resume the venue's in-progress run.
 * Idempotent: repeated calls return the same sample wedding.
 */
export async function startOrResumePracticeRun(): Promise<PracticeRunStartResult> {
  const ctx = await requireVenueStaffContext();
  if (!ctx.ok) return ctx;

  const { client, venueId, userId } = ctx;
  try {
    const existing = await practiceRepo.getActivePracticeRun(client, venueId);
    if (existing) {
      let run = await practiceRepo.touchPracticeRunOpened(client, venueId, existing.id);
      if (!run.sampleLeadId || !run.sampleClientId || !run.sampleEventId) {
        run = await createSampleWedding(client, venueId, run);
      }
      return { ok: true, run, created: false };
    }

    let run = await practiceRepo.insertPracticeRun(
      client,
      venueId,
      PRACTICE_CELEBRATION_NAME,
      userId,
    );
    run = await createSampleWedding(client, venueId, run);
    return { ok: true, run, created: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("practice_runs")) {
      return {
        ok: false,
        message:
          "Practice Run is ready in the app, but the Sandbox database update has not been applied yet. Ask your Hello to Cheers guide to apply the Practice Run migration, then try again.",
      };
    }
    throw error;
  }
}

/**
 * Load a Practice Run only when it belongs to the current active venue.
 * Cross-venue access returns null — never elevates into another venue's practice.
 */
export async function getPracticeRunForCurrentVenue(runId: string): Promise<PracticeRun | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const client = await createClient();
  const run = await practiceRepo.getPracticeRunForVenue(client, venue.id, runId);
  if (!run) return null;
  if (run.status === "in_progress") {
    return practiceRepo.touchPracticeRunOpened(client, venue.id, run.id);
  }
  return run;
}

/** Resolve Practice Run context for a sample Lead/Client/Event in the current venue. */
export async function findPracticeRunForSample(sample: {
  leadId?: string | null;
  clientId?: string | null;
  eventId?: string | null;
}): Promise<PracticeRun | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const client = await createClient();
  return practiceRepo.findPracticeRunBySample(client, venue.id, sample);
}

export async function getPracticeRunIdForRecord(
  table: "leads" | "clients" | "events",
  recordId: string,
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const client = await createClient();
  return practiceRepo.getRecordPracticeRunId(client, table, venue.id, recordId);
}
